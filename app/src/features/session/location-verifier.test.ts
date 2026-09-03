/**
 * 위치 검증기 순수 로직 테스트 — node 환경에서 실행한다. (h3-js 의존)
 *
 * @jest-environment node
 */
import { cellAt, cellsAroundCell, centerOf } from '../territory/tile';
import {
  EXIT_HYSTERESIS_MS,
  MAX_SEGMENT_GAP_MS,
  SPEED_LIMIT_KMH,
  SPEED_SUSTAIN_MS,
} from './session-policy';
import { advanceVerifier, createVerifier, resetAccumulators, type Sample } from './location-verifier';

const BASE = { lat: 37.4979, lng: 127.0276 };
const T0 = 1_000_000;
const STEP_MS = 15_000;
const M_PER_DEG_LAT = 111_320;

/** 진북 방향으로 meters 이동한 위도. */
function northLat(meters: number, lat: number = BASE.lat): number {
  return lat + meters / M_PER_DEG_LAT;
}

/** 시작 좌표에서 초속 speedKmh로 진북하는 샘플 열. */
function movingSamples(
  count: number,
  speedKmh: number,
  startTs: number = T0,
  startLat: number = BASE.lat,
): Sample[] {
  const metersPerStep = (speedKmh / 3.6) * (STEP_MS / 1000);
  return Array.from({ length: count }, (_, i) => ({
    lat: northLat(metersPerStep * i, startLat),
    lng: BASE.lng,
    timestamp: startTs + STEP_MS * i,
  }));
}

/** 시작 셀에서 2링 떨어진 셀의 중심 좌표(보장된 지오펜스 외부). */
function outsidePosition(startCell: string, pick: number): { lat: number; lng: number } {
  const ring2 = cellsAroundCell(startCell, 2).filter(
    (c) => !cellsAroundCell(startCell, 1).includes(c),
  );
  return centerOf(ring2[pick % ring2.length] ?? startCell);
}

describe('location-verifier — 지오펜스·히스테리시스', () => {
  test('첫 샘플은 시작 셀이므로 항상 내부다(#6)', () => {
    const state = createVerifier(cellAt(BASE));
    const decision = advanceVerifier(state, { ...BASE, timestamp: T0 });
    expect(decision.snapshot.isInside).toBe(true);
    expect(decision.snapshot.cellId).toBe(cellAt(BASE));
  });

  test('인접 1링 셀은 내부, 2링 셀은 외부다(#8)', () => {
    const startCell = cellAt(BASE);
    const state = createVerifier(startCell);
    const ring1 = cellsAroundCell(startCell, 1);
    const neighbor = centerOf(ring1[1] ?? startCell);
    const far = outsidePosition(startCell, 0);

    expect(advanceVerifier(state, { ...neighbor, timestamp: T0 }).snapshot.isInside).toBe(true);
    expect(advanceVerifier(state, { ...far, timestamp: T0 + 1 }).snapshot.isInside).toBe(false);
  });

  test('60초 미만 경계 흔들림은 이탈로 판정하지 않는다(#1)', () => {
    const startCell = cellAt(BASE);
    const outside = outsidePosition(startCell, 1);
    const state = createVerifier(startCell);
    let s = advanceVerifier(state, { ...BASE, timestamp: T0 }).state;

    for (let i = 1; i <= 6; i++) {
      const at = T0 + i * 10_000;
      s = advanceVerifier(s, { ...(i % 2 === 0 ? BASE : outside), timestamp: at }).state;
    }
    const last = advanceVerifier(s, { ...BASE, timestamp: T0 + 70_000 });
    expect(last.exitConfirmedAt).toBeUndefined();
  });

  test('외부 59초 후 복귀하면 보류 이탈이 취소된다(#2)', () => {
    const startCell = cellAt(BASE);
    const outside = outsidePosition(startCell, 2);
    const state = createVerifier(startCell);
    let s = advanceVerifier(state, { ...BASE, timestamp: T0 }).state;
    s = advanceVerifier(s, { ...outside, timestamp: T0 + 59_000 }).state;
    const back = advanceVerifier(s, { ...BASE, timestamp: T0 + 60_000 });
    expect(back.exitConfirmedAt).toBeUndefined();
    expect(back.snapshot.isInside).toBe(true);
  });

  test('외부 60초 지속 시 첫 외부 샘플 시각으로 소급 확정한다(#3)', () => {
    const startCell = cellAt(BASE);
    const outside = outsidePosition(startCell, 3);
    const state = createVerifier(startCell);
    let s = advanceVerifier(state, { ...BASE, timestamp: T0 }).state;
    const firstOutsideAt = T0 + EXIT_HYSTERESIS_MS;
    s = advanceVerifier(s, { ...outside, timestamp: firstOutsideAt }).state;
    const confirmed = advanceVerifier(s, { ...outside, timestamp: firstOutsideAt + EXIT_HYSTERESIS_MS });

    expect(confirmed.exitConfirmedAt).toBe(firstOutsideAt);
  });

  test('갭(120초 초과) 후에는 히스테리시스 닻이 재시작된다(#12 지오펜스)', () => {
    const startCell = cellAt(BASE);
    const outside = outsidePosition(startCell, 4);
    const state = createVerifier(startCell);
    let s = advanceVerifier(state, { ...BASE, timestamp: T0 }).state;
    s = advanceVerifier(s, { ...outside, timestamp: T0 + 15_000 }).state;
    const gapTs = T0 + 15_000 + MAX_SEGMENT_GAP_MS + 10_000;
    s = advanceVerifier(s, { ...outside, timestamp: gapTs }).state;
    const notYet = advanceVerifier(s, { ...outside, timestamp: gapTs + 50_000 });
    expect(notYet.exitConfirmedAt).toBeUndefined();

    const confirmed = advanceVerifier(notYet.state, {
      ...outside,
      timestamp: gapTs + EXIT_HYSTERESIS_MS,
    });
    expect(confirmed.exitConfirmedAt).toBe(gapTs);
  });

  test('resetAccumulators는 히스테리시스 닻을 지운다(#5)', () => {
    const startCell = cellAt(BASE);
    const outside = outsidePosition(startCell, 5);
    const state = createVerifier(startCell);
    let s = advanceVerifier(state, { ...BASE, timestamp: T0 }).state;
    s = advanceVerifier(s, { ...outside, timestamp: T0 + 30_000 }).state;
    s = resetAccumulators(s);
    // 리셋 없었다면 T0+30초 닻 기준 80초 경과 → 확정됐어야 한다
    const after = advanceVerifier(s, { ...outside, timestamp: T0 + 110_000 });
    expect(after.exitConfirmedAt).toBeUndefined();
  });
});

describe('location-verifier — 속도 누적', () => {
  test('정지 샘플은 속도 0으로 창을 초기화한다(#13)', () => {
    const state = createVerifier(cellAt(BASE));
    const fast = movingSamples(4, SPEED_LIMIT_KMH + 1);
    let s = advanceVerifier(state, fast[0]!).state;
    for (let i = 1; i < 4; i++) {
      s = advanceVerifier(s, fast[i]!).state;
    }
    const stopped = advanceVerifier(s, {
      lat: fast[3]!.lat,
      lng: BASE.lng,
      timestamp: fast[3]!.timestamp + STEP_MS,
    });
    expect(stopped.snapshot.fastWindowMs).toBe(0);
    expect(stopped.snapshot.speedKmh).toBe(0);
  });

  test('임계 초과 3분 지속 시 창 시작 시각으로 소급 확정한다(#9)', () => {
    const state = createVerifier(cellAt(BASE));
    const fast = movingSamples(13, SPEED_LIMIT_KMH + 1); // 12구간 × 15초 = 180초
    let s = advanceVerifier(state, fast[0]!).state;
    let decision = advanceVerifier(s, fast[1]!);
    for (let i = 2; i < fast.length; i++) {
      s = decision.state;
      decision = advanceVerifier(s, fast[i]!);
    }
    expect(decision.speedConfirmedAt).toBe(fast[0]!.timestamp);
  });

  test('임계 미달 구간이 끼면 창이 초기화되어 확정되지 않는다(#10)', () => {
    const state = createVerifier(cellAt(BASE));
    const fastA = movingSamples(6, SPEED_LIMIT_KMH + 1); // 75초 누적
    const slow = movingSamples(2, SPEED_LIMIT_KMH - 1, fastA[5]!.timestamp + STEP_MS, fastA[5]!.lat);
    const fastB = movingSamples(7, SPEED_LIMIT_KMH + 2, slow[1]!.timestamp + STEP_MS, slow[1]!.lat);
    const segments = [...fastA, ...slow, ...fastB];

    let s = advanceVerifier(state, segments[0]!).state;
    let decision = advanceVerifier(s, segments[1]!);
    for (let i = 2; i < segments.length; i++) {
      s = decision.state;
      decision = advanceVerifier(s, segments[i]!);
    }
    expect(decision.speedConfirmedAt).toBeUndefined();
  });

  test('갭을 사이에 둔 속도 증거는 이어붙지 않는다(#12 속도)', () => {
    const state = createVerifier(cellAt(BASE));
    const part1 = movingSamples(6, SPEED_LIMIT_KMH + 2); // 75초 누적
    const part2 = movingSamples(
      6,
      SPEED_LIMIT_KMH + 2,
      part1[5]!.timestamp + MAX_SEGMENT_GAP_MS + 60_000,
      part1[5]!.lat,
    );
    let s = advanceVerifier(state, part1[0]!).state;
    let decision = advanceVerifier(s, part1[1]!);
    for (let i = 2; i < part1.length; i++) {
      s = decision.state;
      decision = advanceVerifier(s, part1[i]!);
    }
    const afterGap = advanceVerifier(decision.state, part2[0]!);
    expect(afterGap.snapshot.fastWindowMs).toBe(0);
  });

  test('단일 급점프 샘플은 창을 1구간만 채운다(#7)', () => {
    const state = createVerifier(cellAt(BASE));
    const wildLat = northLat(2_000);
    let s = advanceVerifier(state, { ...BASE, timestamp: T0 - STEP_MS }).state;
    const jump = advanceVerifier(s, { lat: wildLat, lng: BASE.lng, timestamp: T0 });
    expect(jump.snapshot.speedKmh).toBeGreaterThan(SPEED_LIMIT_KMH);
    expect(jump.snapshot.fastWindowMs).toBe(STEP_MS);

    // 급점프 지점에서 정지 — 이동 없이 머무르면 창이 초기화된다
    const stay = advanceVerifier(jump.state, { lat: wildLat, lng: BASE.lng, timestamp: T0 + STEP_MS });
    expect(stay.snapshot.fastWindowMs).toBe(0);
    expect(stay.snapshot.speedKmh).toBe(0);
  });

  test('동일 타임스탬프 샘플은 구간에서 제외된다(#12 dt≤0)', () => {
    const state = createVerifier(cellAt(BASE));
    const a = advanceVerifier(state, { ...BASE, timestamp: T0 });
    const dup = advanceVerifier(a.state, { lat: northLat(100), lng: BASE.lng, timestamp: T0 });
    expect(dup.snapshot.speedKmh).toBeUndefined();
    expect(dup.snapshot.fastWindowMs).toBe(0);
  });

  test('SPEED_SUSTAIN_MS 상수는 3분이다(스펙 위동 방지)', () => {
    expect(SPEED_SUSTAIN_MS).toBe(180_000);
  });
});
