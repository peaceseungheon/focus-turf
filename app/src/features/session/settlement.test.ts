/**
 * 세션 정산 순수 로직 테스트 — node 환경에서 실행한다.
 *
 * @jest-environment node
 */
import { settle } from './settlement';
import type { TimelineInterval } from './settlement';

const MIN = 60_000;

describe('settle', () => {
  test('빈 타임라인은 0점이다', () => {
    expect(settle([], 'normal', 0)).toEqual({
      creditedMs: 0,
      creditedMinutes: 0,
      points: 0,
      mode: 'normal',
      zeroReason: 'below_minimum',
    });
  });

  test('1분 미만(#59,999ms)은 0점 — 최소 인정 단위 벼랑(§7)', () => {
    const intervals: TimelineInterval[] = [{ startMs: 0, endMs: MIN - 1 }];
    const result = settle(intervals, 'normal');
    expect(result.points).toBe(0);
    expect(result.zeroReason).toBe('below_minimum');
  });

  test('정확히 1분(60,000ms)은 노멀 10점(#23 경계)', () => {
    const intervals: TimelineInterval[] = [{ startMs: 0, endMs: MIN }];
    const result = settle(intervals, 'normal');
    expect(result.points).toBe(10);
    expect(result.zeroReason).toBeUndefined();
  });

  test('90초 노멀은 15점, 61초는 점 단위 버림으로 10점(#25)', () => {
    expect(settle([{ startMs: 0, endMs: 90_000 }], 'normal').points).toBe(15);
    expect(settle([{ startMs: 0, endMs: 61_000 }], 'normal').points).toBe(10);
  });

  test('하드코어 90초는 18점(분당 12점, §6-②)', () => {
    expect(settle([{ startMs: 0, endMs: 90_000 }], 'hardcore').points).toBe(18);
  });

  test('열린 인터벌은 endedAt에서 닫힌다로 정산한다(#27)', () => {
    const result = settle([{ startMs: 0 }], 'normal', 5 * MIN);
    expect(result.creditedMs).toBe(5 * MIN);
    expect(result.points).toBe(50);
  });

  test('일시정지 구간은 인정 시간에서 제외된다(#24)', () => {
    const intervals: TimelineInterval[] = [
      { startMs: 0, endMs: 10 * MIN },
      // 30분 일시정지
      { startMs: 40 * MIN, endMs: 45 * MIN },
    ];
    const result = settle(intervals, 'normal');
    expect(result.creditedMs).toBe(15 * MIN);
    expect(result.points).toBe(150);
  });

  test('여러 인터벌의 합이 1분을 넘으면 점수가 부여된다', () => {
    // 35초 + 35초 = 70초 → 1.166분 × 10 = 11.67 → 11점
    const intervals: TimelineInterval[] = [
      { startMs: 0, endMs: 35_000 },
      { startMs: MIN, endMs: MIN + 35_000 },
    ];
    expect(settle(intervals, 'normal').points).toBe(11);
  });
});
