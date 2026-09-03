/**
 * 포커스 세션 리듀서 테스트 — node 환경에서 실행한다. (h3-js 간접 의존)
 *
 * @jest-environment node
 */
import { createIdleSession, elapsedMs, reduceSession, type SessionEvent } from './focus-session';
import { HARDCORE_GRACE_MS } from './session-policy';

const CELL = '8ad12a219477ffff';
const T0 = 1_000_000;
const MIN = 60_000;

function start(mode: 'normal' | 'hardcore' = 'normal', at = T0): SessionEvent {
  return { type: 'START', mode, startCellId: CELL, at };
}

describe('focus-session — 기본 전이', () => {
  test('START로 가동 인터벌이 열린다', () => {
    const state = reduceSession(createIdleSession(), start());
    expect(state.status).toBe('running');
    if (state.status !== 'running') return;
    expect(state.runningIntervals).toEqual([{ startMs: T0 }]);
  });

  test('PAUSE_MANUAL은 인터벌을 닫고, RESUME은 새로 연다(#27 계열)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'PAUSE_MANUAL', at: T0 + 2 * MIN });
    expect(state.status).toBe('paused_manual');
    state = reduceSession(state, { type: 'RESUME', at: T0 + 10 * MIN });
    expect(state.status).toBe('running');
    if (state.status !== 'running') return;
    expect(state.runningIntervals).toEqual([
      { startMs: T0, endMs: T0 + 2 * MIN },
      { startMs: T0 + 10 * MIN },
    ]);
  });

  test('가동 중 END는 열린 인터벌을 종료 시각으로 닫아 정산한다(#27)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'END', at: T0 + 5 * MIN });
    if (state.status !== 'finished') throw new Error('finished 아님');
    expect(state.settlement.creditedMs).toBe(5 * MIN);
    expect(state.settlement.points).toBe(50);
    expect(state.endReason).toBe('manual_end');
  });

  test('일시정지 중 END는 이미 닫힌 인터벌만 정산한다(#27)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'PAUSE_MANUAL', at: T0 + 2 * MIN });
    state = reduceSession(state, { type: 'END', at: T0 + 10 * MIN });
    if (state.status !== 'finished') throw new Error('finished 아님');
    expect(state.settlement.creditedMs).toBe(2 * MIN);
    expect(state.settlement.points).toBe(20);
  });

  test('1분 미만 종료는 below_minimum으로 0점이다(§7)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'END', at: T0 + 59_999 });
    if (state.status !== 'finished') throw new Error('finished 아님');
    expect(state.settlement.points).toBe(0);
    expect(state.endReason).toBe('below_minimum');
  });

  test('무효 이벤트는 무시된다(이중 정지, 가동 중 재개, idle에서 정지)(#30)', () => {
    let state = reduceSession(createIdleSession(), start());
    expect(reduceSession(state, { type: 'RESUME', at: T0 + 1 }).status).toBe('running');
    state = reduceSession(state, { type: 'PAUSE_MANUAL', at: T0 + MIN });
    expect(reduceSession(state, { type: 'PAUSE_MANUAL', at: T0 + 2 * MIN }).status).toBe('paused_manual');
    expect(reduceSession(createIdleSession(), { type: 'END', at: T0 }).status).toBe('idle');
  });

  test('SAMPLE은 lastSample만 갱신한다', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, {
      type: 'SAMPLE',
      sample: { lat: 37.4979, lng: 127.0276, timestamp: T0 + 15_000 },
    });
    if (state.status === 'idle') throw new Error('idle이면 안 됨');
    expect(state.lastSample?.timestamp).toBe(T0 + 15_000);
  });
});

describe('focus-session — 자동 일시정지(소급)', () => {
  test('지오펜스 이탈 확정은 첫 외부 샘플 시각에 인터벌을 닫는다(#3 연계)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, {
      type: 'GEOFENCE_EXIT_CONFIRMED',
      effectiveAt: T0 + 3 * MIN,
    });
    expect(state.status).toBe('paused_geofence');
    if (state.status !== 'paused_geofence') return;
    // 확정 전파 시각(T0+4분)이 아니라 이탈 시작(T0+3분)에 닫혔다
    expect(state.runningIntervals).toEqual([{ startMs: T0, endMs: T0 + 3 * MIN }]);
  });

  test('이속 확정도 창 시작 시각에 닫는다', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'SPEED_LIMIT_CONFIRMED', effectiveAt: T0 + 90_000 });
    expect(state.status).toBe('paused_speed');
  });

  test('이미 일시정지인 상태로 도착한 확정은 무시된다(#4)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'PAUSE_MANUAL', at: T0 + MIN });
    state = reduceSession(state, { type: 'GEOFENCE_EXIT_CONFIRMED', effectiveAt: T0 + 2 * MIN });
    expect(state.status).toBe('paused_manual');
  });

  test('LOCATION_UNAVAILABLE은 paused_location으로 전이한다', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'LOCATION_UNAVAILABLE', at: T0 + 2 * MIN });
    expect(state.status).toBe('paused_location');
  });
});

describe('focus-session — 백그라운드·하드코어 유예', () => {
  test('노멀 모드는 백그라운드를 왕복해도 상태와 인터벌이 유지된다(#14)', () => {
    let state = reduceSession(createIdleSession(), start());
    state = reduceSession(state, { type: 'APP_BACKGROUND', at: T0 + MIN });
    state = reduceSession(state, { type: 'APP_FOREGROUND', at: T0 + 31 * MIN });
    expect(state.status).toBe('running');
    expect(elapsedMs(state, T0 + 31 * MIN)).toBe(31 * MIN); // 벽시계 그대로
  });

  test('하드코어 179,999ms 복귀는 생존, 180,000ms는 실패다(#15)', () => {
    let alive = reduceSession(createIdleSession(), start('hardcore'));
    alive = reduceSession(alive, { type: 'APP_BACKGROUND', at: T0 });
    alive = reduceSession(alive, { type: 'APP_FOREGROUND', at: T0 + HARDCORE_GRACE_MS - 1 });
    expect(alive.status).toBe('running');

    let dead = reduceSession(createIdleSession(), start('hardcore', T0));
    dead = reduceSession(dead, { type: 'APP_BACKGROUND', at: T0 + 10_000 });
    dead = reduceSession(dead, {
      type: 'APP_FOREGROUND',
      at: T0 + 10_000 + HARDCORE_GRACE_MS,
    });
    expect(dead.status).toBe('failed_hardcore');
  });

  test('하드코어 실패는 유예 종료 시각까지만 인정한다(#16 소급)', () => {
    let state = reduceSession(createIdleSession(), start('hardcore'));
    state = reduceSession(state, { type: 'APP_BACKGROUND', at: T0 });
    state = reduceSession(state, { type: 'APP_FOREGROUND', at: T0 + 10 * MIN });
    if (state.status !== 'failed_hardcore') throw new Error('failed 아님');
    expect(state.settlement.creditedMs).toBe(HARDCORE_GRACE_MS); // 10분이 아니라 3분
    expect(state.settlement.points).toBe(36); // 3분 × 12점
    expect(state.endReason).toBe('hardcore_fail');
  });

  test('유예 만료 이벤트는 조건을 재검증한다(#17)', () => {
    // 조기 만료 — 무시
    let early = reduceSession(createIdleSession(), start('hardcore'));
    early = reduceSession(early, { type: 'APP_BACKGROUND', at: T0 });
    early = reduceSession(early, { type: 'BACKGROUND_GRACE_EXPIRED', at: T0 + 60_000 });
    expect(early.status).toBe('running');

    // 노멀 모드 — 무시
    let normal = reduceSession(createIdleSession(), start('normal'));
    normal = reduceSession(normal, { type: 'APP_BACKGROUND', at: T0 });
    normal = reduceSession(normal, { type: 'BACKGROUND_GRACE_EXPIRED', at: T0 + 9 * MIN });
    expect(normal.status).toBe('running');

    // 종료 후 늦은 타이머 — 무시
    let ended = reduceSession(createIdleSession(), start('hardcore'));
    ended = reduceSession(ended, { type: 'END', at: T0 + MIN });
    ended = reduceSession(ended, { type: 'BACKGROUND_GRACE_EXPIRED', at: T0 + 9 * MIN });
    expect(ended.status).toBe('finished');
  });

  test('연속 3분 미만 백그라운드 왕복은 실패하지 않는다(#18)', () => {
    let state = reduceSession(createIdleSession(), start('hardcore'));
    for (let cycle = 0; cycle < 2; cycle++) {
      const at = T0 + cycle * 4 * MIN;
      state = reduceSession(state, { type: 'APP_BACKGROUND', at });
      state = reduceSession(state, { type: 'APP_FOREGROUND', at: at + 2 * MIN });
    }
    expect(state.status).toBe('running');
  });

  test('수동 일시정지 중 하드코어 유예 초과도 실패다(Q-C 기본값)', () => {
    let state = reduceSession(createIdleSession(), start('hardcore'));
    state = reduceSession(state, { type: 'PAUSE_MANUAL', at: T0 + MIN });
    state = reduceSession(state, { type: 'APP_BACKGROUND', at: T0 + 2 * MIN });
    state = reduceSession(state, { type: 'BACKGROUND_GRACE_EXPIRED', at: T0 + 2 * MIN + HARDCORE_GRACE_MS });
    expect(state.status).toBe('failed_hardcore');
    if (state.status !== 'failed_hardcore') return;
    expect(state.settlement.creditedMs).toBe(MIN); // 정지 시각까지만
  });
});

describe('focus-session — elapsedMs 셀렉터', () => {
  test('유휴 상태는 0이다', () => {
    expect(elapsedMs(createIdleSession(), T0)).toBe(0);
  });

  test('열린 인터벌은 now까지, 종료 상태는 정산값으로 고정이다', () => {
    const running = reduceSession(createIdleSession(), start());
    expect(elapsedMs(running, T0 + 90_000)).toBe(90_000);

    let done = reduceSession(createIdleSession(), start());
    done = reduceSession(done, { type: 'END', at: T0 + 5 * MIN });
    expect(elapsedMs(done, T0 + 100 * MIN)).toBe(5 * MIN);
  });

  test('기기 시계 역행으로 음수가 되면 0으로 고정한다(#20)', () => {
    const running = reduceSession(createIdleSession(), start('normal', T0 + 10_000));
    expect(elapsedMs(running, T0)).toBe(0);
  });
});
