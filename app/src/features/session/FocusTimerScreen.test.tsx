/**
 * 집중 타이머 화면 테스트 — 훅은 모의로 대체하고 화면 전이만 검증한다.
 * RNTL v14 표준 입력 방식(userEvent)을 사용한다.
 */
import { render, screen, userEvent } from '@testing-library/react-native';

import { FocusTimerScreen } from './FocusTimerScreen';
import { useFocusSession, type UseFocusSessionResult } from './use-focus-session';

jest.mock('./use-focus-session', () => ({
  useFocusSession: jest.fn(),
}));

const start = jest.fn().mockResolvedValue(undefined);
const pause = jest.fn();
const resume = jest.fn();
const end = jest.fn().mockResolvedValue(undefined);

const baseResult: UseFocusSessionResult = {
  status: 'idle',
  mode: null,
  elapsedMs: 0,
  snapshot: null,
  lastSettlement: null,
  notice: null,
  actions: { start, pause, resume, end },
};

function mockHook(overrides: Partial<UseFocusSessionResult>): void {
  jest.mocked(useFocusSession).mockReturnValue({ ...baseResult, ...overrides });
}

describe('FocusTimerScreen', () => {
  beforeEach(() => {
    start.mockClear();
    pause.mockClear();
    resume.mockClear();
    end.mockClear();
  });

  test('유휴 화면은 모드 선택과 시작 버튼을 표시한다', async () => {
    mockHook({ status: 'idle' });
    const user = userEvent.setup();
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    expect(screen.getByText('집중할 모드를 선택하세요')).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '시작' }));
    expect(start).toHaveBeenCalledWith('normal');
  });

  test('모드 토글로 하드코어를 선택할 수 있다', async () => {
    mockHook({ status: 'idle' });
    const user = userEvent.setup();
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    await user.press(screen.getByRole('button', { name: '노멀' }));
    await user.press(screen.getByRole('button', { name: '시작' }));
    expect(start).toHaveBeenCalledWith('hardcore');
  });

  test('가동 중 화면은 경과 시계와 정지·종료를 표시한다', async () => {
    mockHook({ status: 'running', mode: 'normal', elapsedMs: 65_000 });
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    expect(screen.getByText('01:05')).toBeTruthy();
    expect(screen.getByText('노멀 · 집중 중')).toBeTruthy();
  });

  test('지오펜스 자동 일시정지는 안내 문구와 재개 버튼을 표시한다', async () => {
    mockHook({
      status: 'paused_geofence',
      mode: 'normal',
      elapsedMs: 120_000,
      snapshot: { cellId: 'c', isInside: true, fastWindowMs: 0 },
    });
    const user = userEvent.setup();
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    expect(screen.getByText(/타일을 이탈해/)).toBeTruthy();
    await user.press(screen.getByRole('button', { name: '재개' }));
    expect(resume).toHaveBeenCalled();
  });

  test('타일 외부에 있을 때는 자동 일시정지 재개 버튼이 없다', async () => {
    mockHook({
      status: 'paused_geofence',
      mode: 'normal',
      elapsedMs: 120_000,
      snapshot: { cellId: 'c', isInside: false, fastWindowMs: 0 },
    });
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    expect(screen.queryByRole('button', { name: '재개' })).toBeNull();
  });

  test('종료 화면은 정산 결과를 표시한다', async () => {
    mockHook({
      status: 'finished',
      mode: 'normal',
      elapsedMs: 300_000,
      lastSettlement: { creditedMs: 300_000, creditedMinutes: 5, points: 50, mode: 'normal' },
    });
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    expect(screen.getByText('세션 종료')).toBeTruthy();
    expect(screen.getByText('점수 50점')).toBeTruthy();
    expect(screen.getByText('인정 시간 05:00')).toBeTruthy();
  });

  test('하드코어 실패 화면은 실패 안내를 표시한다', async () => {
    mockHook({ status: 'failed_hardcore', mode: 'hardcore', elapsedMs: 180_000 });
    await render(<FocusTimerScreen onBack={jest.fn()} />);

    expect(screen.getByText('하드코어 실패')).toBeTruthy();
  });
});
