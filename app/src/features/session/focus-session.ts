/**
 * 포커스 세션 상태머신 리듀서(§7) — 시간 이벤트만 받는 순수 함수.
 * 위치 좌표 해석은 location-verifier가 담당하고, 이 모듈은 검증기가 확정한
 * 의미 이벤트(소급 시각 포함)를 타임라인에 반영한다.
 *
 * 경과 시간은 TICK으로 세지 않고 가동 인터벌 목록에서 도출한다(무TICK 설계).
 * 백그라운드 연속성: 하드코어 유예 판정은 타이머 이벤트와 복귀 이벤트 양쪽에서
 * 벽시계로 재검증한다(JS 타이머는 백그라운드에서 불신).
 */
import type { SessionMode, SessionStatus, EndReason } from './session-policy';
import { HARDCORE_GRACE_MS } from './session-policy';
import { settle, type SettlementResult, type TimelineInterval } from './settlement';
import type { Sample } from './location-verifier';

export type { Sample };

/** 가동·일시정지 등 진행 중 상태. */
export type ActiveStatus = Extract<
  SessionStatus,
  'running' | 'paused_manual' | 'paused_geofence' | 'paused_speed' | 'paused_location'
>;

interface SessionContext {
  mode: SessionMode;
  startCellId: string;
  startedAt: number;
  runningIntervals: ReadonlyArray<TimelineInterval>;
  lastSample?: Sample;
  backgroundedAt?: number;
}

export type FocusSessionState =
  | { status: 'idle' }
  | ({ status: ActiveStatus } & SessionContext)
  | ({
      status: 'finished' | 'failed_hardcore';
      endedAt: number;
      endReason: EndReason;
      settlement: SettlementResult;
    } & SessionContext);

export type SessionEvent =
  | { type: 'START'; mode: SessionMode; startCellId: string; at: number }
  | { type: 'PAUSE_MANUAL'; at: number }
  | { type: 'RESUME'; at: number }
  | { type: 'END'; at: number }
  | { type: 'GEOFENCE_EXIT_CONFIRMED'; effectiveAt: number }
  | { type: 'SPEED_LIMIT_CONFIRMED'; effectiveAt: number }
  | { type: 'LOCATION_UNAVAILABLE'; at: number }
  | { type: 'SAMPLE'; sample: Sample }
  | { type: 'APP_BACKGROUND'; at: number }
  | { type: 'APP_FOREGROUND'; at: number }
  | { type: 'BACKGROUND_GRACE_EXPIRED'; at: number };

export function createIdleSession(): FocusSessionState {
  return { status: 'idle' };
}

function isActive(state: FocusSessionState): state is { status: ActiveStatus } & SessionContext {
  return (
    state.status === 'running' ||
    state.status === 'paused_manual' ||
    state.status === 'paused_geofence' ||
    state.status === 'paused_speed' ||
    state.status === 'paused_location'
  );
}

function isTerminal(
  state: FocusSessionState,
): state is Extract<FocusSessionState, { endedAt: number }> {
  return state.status === 'finished' || state.status === 'failed_hardcore';
}

function closeOpenInterval(
  intervals: ReadonlyArray<TimelineInterval>,
  at: number,
): TimelineInterval[] {
  const last = intervals[intervals.length - 1];
  if (last === undefined || last.endMs !== undefined) {
    return [...intervals];
  }
  // 기기 시계 역행 등으로 시작보다 빠른 종료는 시작 시각으로 고정한다
  const endMs = Math.max(last.startMs, at);
  return [...intervals.slice(0, -1), { startMs: last.startMs, endMs }];
}

function toFinished(
  context: SessionContext,
  status: 'finished' | 'failed_hardcore',
  endedAt: number,
  endReason: EndReason,
): FocusSessionState {
  const settlement = settle(context.runningIntervals, context.mode);
  return { ...context, status, endedAt, endReason, settlement };
}

function failHardcoreAtGraceEdge(
  context: { status: ActiveStatus } & SessionContext,
): FocusSessionState {
  const cutAt =
    context.backgroundedAt === undefined
      ? context.startedAt
      : context.backgroundedAt + HARDCORE_GRACE_MS;
  const intervals =
    context.status === 'running'
      ? closeOpenInterval(context.runningIntervals, cutAt)
      : context.runningIntervals;
  return {
    ...context,
    runningIntervals: intervals,
    status: 'failed_hardcore',
    endedAt: cutAt,
    endReason: 'hardcore_fail',
    settlement: settle(intervals, context.mode),
  };
}

export function reduceSession(state: FocusSessionState, event: SessionEvent): FocusSessionState {
  // 종료 상태는 늦은 타이머 등 모든 이벤트를 무시하되, START(새 세션 시작)만 허용한다
  if (isTerminal(state) && event.type !== 'START') {
    return state;
  }

  switch (event.type) {
    case 'START': {
      // idle·종료 상태에서만 새 세션을 연다(가동·일시정지 중 이중 시작은 무시)
      if (isActive(state)) {
        return state;
      }
      return {
        status: 'running',
        mode: event.mode,
        startCellId: event.startCellId,
        startedAt: event.at,
        runningIntervals: [{ startMs: event.at }],
      };
    }
    case 'SAMPLE': {
      if (!isActive(state)) {
        return state;
      }
      return { ...state, lastSample: event.sample };
    }
    case 'PAUSE_MANUAL': {
      if (state.status !== 'running') {
        return state;
      }
      return { ...state, status: 'paused_manual', runningIntervals: closeOpenInterval(state.runningIntervals, event.at) };
    }
    case 'RESUME': {
      if (state.status === 'idle' || state.status === 'running') {
        return state;
      }
      return {
        ...state,
        status: 'running',
        runningIntervals: [...state.runningIntervals, { startMs: event.at }],
      };
    }
    case 'END': {
      if (!isActive(state)) {
        return state;
      }
      const intervals =
        state.status === 'running'
          ? closeOpenInterval(state.runningIntervals, event.at)
          : state.runningIntervals;
      const endReason: EndReason =
        settle(intervals, state.mode).zeroReason === 'below_minimum'
          ? 'below_minimum'
          : 'manual_end';
      return toFinished({ ...state, runningIntervals: intervals }, 'finished', event.at, endReason);
    }
    case 'GEOFENCE_EXIT_CONFIRMED': {
      if (state.status !== 'running') {
        return state;
      }
      return {
        ...state,
        status: 'paused_geofence',
        runningIntervals: closeOpenInterval(state.runningIntervals, event.effectiveAt),
      };
    }
    case 'SPEED_LIMIT_CONFIRMED': {
      if (state.status !== 'running') {
        return state;
      }
      return {
        ...state,
        status: 'paused_speed',
        runningIntervals: closeOpenInterval(state.runningIntervals, event.effectiveAt),
      };
    }
    case 'LOCATION_UNAVAILABLE': {
      if (state.status !== 'running') {
        return state;
      }
      return {
        ...state,
        status: 'paused_location',
        runningIntervals: closeOpenInterval(state.runningIntervals, event.at),
      };
    }
    case 'APP_BACKGROUND': {
      if (!isActive(state)) {
        return state;
      }
      return { ...state, backgroundedAt: event.at };
    }
    case 'APP_FOREGROUND': {
      if (!isActive(state) || state.backgroundedAt === undefined) {
        return state;
      }
      const { backgroundedAt, ...rest } = state;
      if (
        state.mode === 'hardcore' &&
        event.at - backgroundedAt >= HARDCORE_GRACE_MS
      ) {
        return failHardcoreAtGraceEdge({ ...rest, backgroundedAt });
      }
      return rest; // backgroundedAt 해제
    }
    case 'BACKGROUND_GRACE_EXPIRED': {
      if (!isActive(state) || state.backgroundedAt === undefined || state.mode !== 'hardcore') {
        return state;
      }
      if (event.at - state.backgroundedAt < HARDCORE_GRACE_MS) {
        return state; // 조기 도착한 타이머 — 벽시계로 기각
      }
      return failHardcoreAtGraceEdge(state);
    }
    default:
      return state;
  }
}

/** 경과 밀리초 — 닫힌 인터벌 합 + 가동 중이면 열린 인터벌을 now까지. */
export function elapsedMs(state: FocusSessionState, now: number): number {
  if (state.status === 'idle') {
    return 0;
  }
  if (isTerminal(state)) {
    return state.settlement.creditedMs;
  }
  let sum = 0;
  for (const interval of state.runningIntervals) {
    const end = interval.endMs ?? (state.status === 'running' ? now : interval.startMs);
    sum += Math.max(0, end - interval.startMs);
  }
  return sum;
}
