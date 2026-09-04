/**
 * useFocusSession 훅 테스트 — 서비스·AppState 모의 + 가짜 타이머.
 *
 * RNTL v14 참고: act() 콜백 실행 중에는 result.current가 무효화된다.
 * 따라서 act 전에 actions를 캡처하고, 상태 판독은 act 완료 후에 한다.
 */
import { act, renderHook, waitFor, type RenderHookResult } from '@testing-library/react-native';
import { AppState } from 'react-native';

import type { Sample } from './location-verifier';
import { useFocusSession, type UseFocusSessionResult } from './use-focus-session';
import { cellAt } from '../territory/tile';
import {
  getCurrentSample,
  requestWhenInUsePermission,
  startSampleWatch,
} from '../../services/location/location-service';
import { appendSessionEntry } from '../../services/storage/session-log';
import { readPrivateZones } from '../../services/storage/private-zone-store';
import { readTerritory, writeTerritory } from '../../services/storage/territory-store';

jest.mock('../../services/location/location-service', () => ({
  requestWhenInUsePermission: jest.fn(),
  getCurrentSample: jest.fn(),
  startSampleWatch: jest.fn(),
}));

jest.mock('../../services/storage/session-log', () => ({
  appendSessionEntry: jest.fn(),
}));

jest.mock('../../services/storage/territory-store', () => ({
  readTerritory: jest.fn(),
  writeTerritory: jest.fn(),
}));

jest.mock('../../services/storage/private-zone-store', () => ({
  readPrivateZones: jest.fn(),
}));

const BASE_SAMPLE: Sample = { lat: 37.4979, lng: 127.0276, timestamp: 1_000 };

type SampleListener = (sample: Sample) => void;
type HookRender = RenderHookResult<UseFocusSessionResult, undefined>;

let pushSample: SampleListener | undefined;

function mockGrantedWatch(): void {
  jest.mocked(requestWhenInUsePermission).mockResolvedValue('granted');
  jest.mocked(getCurrentSample).mockResolvedValue(BASE_SAMPLE);
  jest.mocked(startSampleWatch).mockImplementation((callbacks) => {
    pushSample = callbacks.onSample;
    return Promise.resolve({ remove: jest.fn().mockResolvedValue(undefined) });
  });
}

function appStateChange(status: string): void {
  const listeners = jest.mocked(AppState.addEventListener).mock.calls
    .map((call) => call[1])
    .filter((listener): listener is (state: string) => void => typeof listener === 'function');
  for (const listener of listeners) {
    listener(status);
  }
}

function currentOf(rendered: HookRender): UseFocusSessionResult {
  const value = rendered.result.current;
  if (value === undefined || value === null) {
    throw new Error('훅 렌더 결과가 아직 유효하지 않다');
  }
  return value;
}

async function startSession(rendered: HookRender, mode: 'normal' | 'hardcore'): Promise<void> {
  const actions = currentOf(rendered).actions;
  await act(async () => {
    await actions.start(mode);
  });
}

function pushInAct(sample: Sample, advanceMs = 0): Promise<void> {
  return act(async () => {
    pushSample?.(sample);
    if (advanceMs > 0) {
      jest.advanceTimersByTime(advanceMs);
    }
  });
}

describe('useFocusSession', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    pushSample = undefined;
    jest.mocked(requestWhenInUsePermission).mockReset();
    jest.mocked(getCurrentSample).mockReset();
    jest.mocked(startSampleWatch).mockReset();
    jest.mocked(appendSessionEntry).mockReset();
    jest.mocked(appendSessionEntry).mockResolvedValue(undefined);
    jest.mocked(readTerritory).mockReset();
    jest.mocked(readTerritory).mockResolvedValue({});
    jest.mocked(writeTerritory).mockReset();
    jest.mocked(writeTerritory).mockResolvedValue(undefined);
    jest.mocked(readPrivateZones).mockReset();
    jest.mocked(readPrivateZones).mockResolvedValue(new Set());
    jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() } as never);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  test('권한 거부 시 시작하지 않고 안내를 표시한다(#29)', async () => {
    jest.mocked(requestWhenInUsePermission).mockResolvedValue('denied');
    const rendered = await renderHook(() => useFocusSession());

    await startSession(rendered, 'normal');

    expect(currentOf(rendered).status).toBe('idle');
    expect(currentOf(rendered).notice).toContain('위치 권한');
    expect(startSampleWatch).not.toHaveBeenCalled();
  });

  test('권한 허용 시 현재 셀로 세션이 시작된다', async () => {
    mockGrantedWatch();
    const rendered = await renderHook(() => useFocusSession());

    await startSession(rendered, 'normal');

    expect(currentOf(rendered).status).toBe('running');
    expect(currentOf(rendered).mode).toBe('normal');
    expect(startSampleWatch).toHaveBeenCalledTimes(1);
  });

  test('샘플 → 지오펜스 확정 → 자동 일시정지 → 복귀 샘플 후 재개', async () => {
    mockGrantedWatch();
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');

    await pushInAct({ ...BASE_SAMPLE, timestamp: 2_000 });
    expect(currentOf(rendered).snapshot?.isInside).toBe(true);

    const far = { lat: BASE_SAMPLE.lat + 0.002, lng: BASE_SAMPLE.lng, timestamp: 3_000 };
    await pushInAct(far, 1_000);
    await pushInAct({ ...far, timestamp: 63_000 });
    expect(currentOf(rendered).status).toBe('paused_geofence');

    await pushInAct({ ...BASE_SAMPLE, timestamp: 64_000 });
    expect(currentOf(rendered).snapshot?.isInside).toBe(true);

    const resume = currentOf(rendered).actions.resume;
    await act(async () => {
      resume();
    });
    expect(currentOf(rendered).status).toBe('running');
  });

  test('종료 시 세션 로그를 정확히 한 번 저장한다(#35 일회성)', async () => {
    mockGrantedWatch();
    jest.mocked(appendSessionEntry).mockResolvedValue(undefined);
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });

    const end = currentOf(rendered).actions.end;
    await act(async () => {
      await end();
    });

    expect(currentOf(rendered).status).toBe('finished');
    expect(currentOf(rendered).lastSettlement?.points).toBeGreaterThanOrEqual(10);
    expect(appendSessionEntry).toHaveBeenCalledTimes(1);

    const endAgain = currentOf(rendered).actions.end;
    await act(async () => {
      await endAgain();
    });
    expect(appendSessionEntry).toHaveBeenCalledTimes(1);
  });

  test('종료 시 정산 점수가 타일 점령 상태에 반영된다(§6-②)', async () => {
    mockGrantedWatch();
    const cell = cellAt(BASE_SAMPLE);
    jest.mocked(readTerritory).mockResolvedValue({
      [cell]: { cellId: cell, score: 90, lastEarnedAt: Date.now() },
    });
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });

    const end = currentOf(rendered).actions.end;
    await act(async () => {
      await end();
    });

    await waitFor(() => expect(currentOf(rendered).lastOccupation).not.toBeNull());
    expect(currentOf(rendered).lastOccupation).toEqual({
      cellId: cell,
      score: 100, // 기존 90점 + 세션 10점 — 문턱 통과
      occupied: true,
    });
    expect(writeTerritory).toHaveBeenCalledTimes(1);
  });

  test('0점 세션은 점령 상태를 건드리지 않는다(§7 최소 인정 단위)', async () => {
    mockGrantedWatch();
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');
    await act(async () => {
      jest.advanceTimersByTime(30_000);
    });

    const end = currentOf(rendered).actions.end;
    await act(async () => {
      await end();
    });

    expect(currentOf(rendered).status).toBe('finished');
    expect(writeTerritory).not.toHaveBeenCalled();
    expect(currentOf(rendered).lastOccupation).toBeNull();
  });

  test('보호 구역 타일 세션은 점령에 반영하지 않고 개인 통계만 남긴다(§9)', async () => {
    mockGrantedWatch();
    const cell = cellAt(BASE_SAMPLE);
    jest.mocked(readPrivateZones).mockResolvedValue(new Set([cell]));
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');
    await act(async () => {
      jest.advanceTimersByTime(61_000);
    });
    expect(currentOf(rendered).protectedTile).toBe(true);

    const end = currentOf(rendered).actions.end;
    await act(async () => {
      await end();
    });

    expect(currentOf(rendered).status).toBe('finished');
    expect(writeTerritory).not.toHaveBeenCalled();
    expect(currentOf(rendered).lastOccupation).toBeNull();
    expect(appendSessionEntry).toHaveBeenCalledTimes(1);
    const entry = jest.mocked(appendSessionEntry).mock.calls[0][0];
    expect(entry.cellId).toBe(cell);
    expect(entry.points).toBeGreaterThan(0);
  });

  test('하드코어 백그라운드 3분 경과 타이머는 실패로 이어진다(#15 연계)', async () => {
    mockGrantedWatch();
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'hardcore');

    await act(async () => {
      appStateChange('background');
    });
    expect(currentOf(rendered).status).toBe('running'); // 유예 중

    await act(async () => {
      jest.advanceTimersByTime(180_000);
    });
    await waitFor(() => expect(currentOf(rendered).status).toBe('failed_hardcore'));
    expect(currentOf(rendered).lastSettlement?.points).toBe(36); // 3분 × 12점
  });

  test('유예 내 복귀하면 타이머가 취소되어 생존한다', async () => {
    mockGrantedWatch();
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'hardcore');

    const backgroundedAt = Date.now();
    await act(async () => {
      appStateChange('background');
      jest.advanceTimersByTime(100_000);
      appStateChange('active');
      // 복귀 직후 새 샘플 — 샘플 부재 일시정지와 분리한다
      pushSample?.({ ...BASE_SAMPLE, timestamp: backgroundedAt + 100_000 });
      // 취소 실패 시 유예 타이머가 이 시점(배경+180초)에 발화한다
      jest.advanceTimersByTime(80_000);
    });
    expect(currentOf(rendered).status).toBe('running');
  });

  test('언마운트 시 구독과 타이머가 정리된다(#34)', async () => {
    mockGrantedWatch();
    const remove = jest.fn().mockResolvedValue(undefined);
    jest.mocked(startSampleWatch).mockImplementation((callbacks) => {
      pushSample = callbacks.onSample;
      return Promise.resolve({ remove });
    });
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');

    await rendered.unmount();
    await waitFor(() => expect(remove).toHaveBeenCalled());
  });

  test('90초 샘플 부재 시 위치 불능 일시정지로 전이한다(#33)', async () => {
    mockGrantedWatch();
    const rendered = await renderHook(() => useFocusSession());
    await startSession(rendered, 'normal');

    await pushInAct({ ...BASE_SAMPLE, timestamp: 5_000 }, 91_000);
    expect(currentOf(rendered).status).toBe('paused_location');
  });
});
