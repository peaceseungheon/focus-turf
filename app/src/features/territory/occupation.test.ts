/**
 * 영토 점령 도메인 테스트 — node 환경에서 실행한다.
 *
 * @jest-environment node
 */
import {
  applyDecay,
  applyEarning,
  decayCheckpointsBetween,
  isOccupied,
  type TileOccupation,
} from './occupation';
import { DECAY_INACTIVITY_WINDOW_MS } from './territory-policy';

const CELL = '8ad12a219477ffff';

/** KST 04:00 판정 시각 — Date.UTC(월은 0 기준)로 결정론적으로 만든다. */
function kst4(year: number, month1to12: number, day: number): number {
  return Date.UTC(year, month1to12 - 1, day - 1, 19, 0, 0);
}

function tile(score: number, lastEarnedAt: number): TileOccupation {
  return { cellId: CELL, score, lastEarnedAt };
}

describe('occupation — 획득 반영', () => {
  test('획득 점수를 가산하고 획득 시각을 갱신한다', () => {
    const earned = applyEarning(tile(90, 1_000), 30, 5_000);
    expect(earned.score).toBe(120);
    expect(earned.lastEarnedAt).toBe(5_000);
  });

  test('0점 획득은 상태를 바꾸지 않는다', () => {
    const before = tile(90, 1_000);
    expect(applyEarning(before, 0, 5_000)).toBe(before);
  });
});

describe('occupation — 점령 문턱(§6-②)', () => {
  test('보유 99점은 미점령, 100점은 점령 성립이다', () => {
    expect(isOccupied(tile(99, 1_000))).toBe(false);
    expect(isOccupied(tile(100, 1_000))).toBe(true);
  });
});

describe('occupation — 감쇠 판정 시각 계산', () => {
  test('KST 04:00(UTC 전일 19:00) 정각을 나열한다', () => {
    const from = Date.UTC(2026, 8, 1, 0, 0, 0);
    const to = Date.UTC(2026, 8, 3, 0, 0, 0);
    expect(decayCheckpointsBetween(from, to)).toEqual([
      kst4(2026, 9, 2),
      kst4(2026, 9, 3),
    ]);
  });

  test('from이 판정 시각과 일치하면 그 판정은 제외한다(이미 지난 판정)', () => {
    const at = kst4(2026, 9, 2);
    expect(decayCheckpointsBetween(at, kst4(2026, 9, 3))).toEqual([kst4(2026, 9, 3)]);
    expect(decayCheckpointsBetween(at, at)).toEqual([]);
  });
});

describe('occupation — 감쇠 적용(§6-③)', () => {
  test('지난 판정이 없으면 상태를 유지한다', () => {
    const before = tile(500, kst4(2026, 9, 2) + 60_000);
    expect(applyDecay(before, kst4(2026, 9, 2) + 3_600_000)).toBe(before);
  });

  test('획득 후 24시간 내 판정은 감쇠하지 않는다', () => {
    // 04:00 판정 10분 전에 획득 — 직전 24시간 창에 획득이 있다
    const earnedAt = kst4(2026, 9, 2) - 10 * 60_000;
    const before = tile(500, earnedAt);
    expect(applyDecay(before, kst4(2026, 9, 2))).toBe(before);
  });

  test('획득이 정확히 24시간 전이면 감쇠한다(창 경계 해석 고정)', () => {
    const earnedAt = kst4(2026, 9, 2) - DECAY_INACTIVITY_WINDOW_MS;
    const after = applyDecay(tile(500, earnedAt), kst4(2026, 9, 2));
    expect(after.score).toBe(425); // 500 × 0.85
    expect(after.lastEarnedAt).toBe(earnedAt); // 감쇠는 획득 시각을 내리지 않는다
  });

  test('무활동 판정마다 15%씩 순차 감쇠한다 — 14일 후 약 10% 잔존(§6-③ 참고계산)', () => {
    const earnedAt = kst4(2026, 9, 2) - 60_000;
    const after = applyDecay(tile(1_000, earnedAt), kst4(2026, 9, 16));
    expect(after.score).toBe(100); // 0.85^14 내림 체인
  });

  test('감쇠로 문턱 밑으로 떨어지면 점령 상실이다', () => {
    const earnedAt = kst4(2026, 9, 2) - 60_000;
    const after = applyDecay(tile(101, earnedAt), kst4(2026, 9, 3));
    expect(after.score).toBe(85);
    expect(isOccupied(after)).toBe(false);
  });

  test('재획득하면 감쇠 기준 시점이 갱신된다', () => {
    const stale = tile(500, kst4(2026, 9, 2) - 60_000);
    const after = applyDecay(stale, kst4(2026, 9, 4)); // 2회 감쇠
    expect(after.score).toBe(361); // 500 → 425 → 361
    const reearned = applyEarning(after, 200, kst4(2026, 9, 4) + 3_600_000);
    expect(reearned.score).toBe(561);
    // 재획득 시점부터는 아직 지난 판정이 없다
    expect(applyDecay(reearned, kst4(2026, 9, 4) + 3_600_000)).toBe(reearned);
  });

  test('보유 0점 타일은 감쇠 계산을 하지 않는다', () => {
    const zero = tile(0, 0);
    expect(applyDecay(zero, Date.now())).toBe(zero);
  });
});
