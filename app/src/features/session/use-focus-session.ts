/**
 * 포커스 세션 훅 — 순수 도메인(리듀서·검증기)과 기기(위치 구독·AppState)를 잇는 얇은 껍데기.
 *
 * 시간 원칙: 인정 시간은 오직 리듀서의 인터벌 목록에서 나온다. JS 타이머는
 * UI 갱신(1초 티커)과 하드코어 유예 알림에만 쓰이고, 유예 판정은 리듀서가
 * 이벤트에 실린 벽시계로 재검증한다.
 */
import { useEffect, useReducer, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import type * as Location from 'expo-location';

import { cellAt } from '../territory/tile';
import {
  createVerifier,
  advanceVerifier,
  resetAccumulators,
  type Sample,
  type VerifierSnapshot,
  type VerifierState,
} from './location-verifier';
import {
  createIdleSession,
  elapsedMs,
  reduceSession,
  type FocusSessionState,
} from './focus-session';
import {
  HARDCORE_GRACE_MS,
  SAMPLE_STALE_MS,
  type SessionMode,
  type SessionStatus,
} from './session-policy';
import type { SettlementResult } from './settlement';
import {
  getCurrentSample,
  requestWhenInUsePermission,
  startSampleWatch,
} from '../../services/location/location-service';
import { appendSessionEntry } from '../../services/storage/session-log';
import { readTerritory, writeTerritory } from '../../services/storage/territory-store';
import {
  applyDecay,
  applyEarning,
  isOccupied,
  type TileOccupation,
} from '../territory/occupation';

const TERMINAL_STATUSES: ReadonlySet<SessionStatus> = new Set(['finished', 'failed_hardcore']);

/** 세션 종료 직후 해당 타일의 점령 현황(정산 화면 표시용). */
export interface OccupationOutcome {
  cellId: string;
  score: number;
  occupied: boolean;
}

export interface UseFocusSessionResult {
  status: SessionStatus;
  mode: SessionMode | null;
  elapsedMs: number;
  snapshot: VerifierSnapshot | null;
  lastSettlement: SettlementResult | null;
  lastOccupation: OccupationOutcome | null;
  /** 경계 표시용 사용자 안내(권한 거부, 저장 실패 등). */
  notice: string | null;
  actions: {
    start: (mode: SessionMode) => Promise<void>;
    pause: () => void;
    resume: () => void;
    end: () => void;
  };
}

export function useFocusSession(): UseFocusSessionResult {
  const [state, dispatch] = useReducer(reduceSession, undefined, createIdleSession);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [snapshot, setSnapshot] = useState<VerifierSnapshot | null>(null);
  const [lastSettlement, setLastSettlement] = useState<SettlementResult | null>(null);
  const [lastOccupation, setLastOccupation] = useState<OccupationOutcome | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const verifierRef = useRef<VerifierState | null>(null);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const graceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const staleCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSampleAtRef = useRef<number | null>(null);
  const persistedRef = useRef(false);
  const modeRef = useRef<SessionMode>('normal');
  const stateRef = useRef<FocusSessionState>(state);
  stateRef.current = state;

  async function stopWatch(): Promise<void> {
    const watch = watchRef.current;
    watchRef.current = null;
    if (staleCheckRef.current !== null) {
      clearInterval(staleCheckRef.current);
      staleCheckRef.current = null;
    }
    await watch?.remove();
  }

  function armStaleCheck(): void {
    lastSampleAtRef.current = Date.now();
    if (staleCheckRef.current !== null) {
      return;
    }
    staleCheckRef.current = setInterval(() => {
      const last = lastSampleAtRef.current;
      const current = stateRef.current;
      // 백그라운드 중 구독 정지는 OS 정상 동작이므로 포그라운드 가동 중에만 판정한다
      const backgrounded = 'backgroundedAt' in current && current.backgroundedAt !== undefined;
      if (
        current.status === 'running' &&
        !backgrounded &&
        last !== null &&
        Date.now() - last > SAMPLE_STALE_MS
      ) {
        dispatch({ type: 'LOCATION_UNAVAILABLE', at: Date.now() });
      }
    }, SAMPLE_STALE_MS / 3);
  }

  function handleSample(sample: Sample): void {
    lastSampleAtRef.current = sample.timestamp;
    const verifier = verifierRef.current;
    if (verifier === null) {
      return;
    }
    const decision = advanceVerifier(verifier, sample);
    verifierRef.current = decision.state;
    setSnapshot(decision.snapshot);
    dispatch({ type: 'SAMPLE', sample });
    if (decision.exitConfirmedAt !== undefined) {
      dispatch({ type: 'GEOFENCE_EXIT_CONFIRMED', effectiveAt: decision.exitConfirmedAt });
    }
    if (decision.speedConfirmedAt !== undefined) {
      dispatch({ type: 'SPEED_LIMIT_CONFIRMED', effectiveAt: decision.speedConfirmedAt });
    }
  }

  async function startWatch(): Promise<void> {
    watchRef.current = await startSampleWatch({
      onSample: handleSample,
      onError: () => {
        if (stateRef.current.status === 'running') {
          dispatch({ type: 'LOCATION_UNAVAILABLE', at: Date.now() });
        }
      },
    });
    armStaleCheck();
  }

  function cancelGraceTimer(): void {
    if (graceTimerRef.current !== null) {
      clearTimeout(graceTimerRef.current);
      graceTimerRef.current = null;
    }
  }

  async function start(mode: SessionMode): Promise<void> {
    const permission = await requestWhenInUsePermission();
    if (permission === 'denied') {
      setNotice('위치 권한이 필요합니다. 설정에서 위치 접근을 허용해 주세요.');
      return;
    }
    const sample = await getCurrentSample();
    modeRef.current = mode;
    verifierRef.current = createVerifier(cellAt(sample));
    persistedRef.current = false;
    setSnapshot(null);
    setLastSettlement(null);
    setLastOccupation(null);
    dispatch({ type: 'START', mode, startCellId: cellAt(sample), at: Date.now() });
    await startWatch();
  }

  function pause(): void {
    dispatch({ type: 'PAUSE_MANUAL', at: Date.now() });
  }

  function resume(): void {
    const verifier = verifierRef.current;
    if (verifier !== null) {
      verifierRef.current = resetAccumulators(verifier);
    }
    dispatch({ type: 'RESUME', at: Date.now() });
    armStaleCheck();
  }

  async function end(): Promise<void> {
    dispatch({ type: 'END', at: Date.now() });
    await stopWatch();
  }

  async function reflectEarning(
    cellId: string,
    points: number,
    earnedAt: number,
  ): Promise<OccupationOutcome | null> {
    if (points <= 0) {
      return null; // 0점 세션은 점령 상태를 바꾸지 않는다
    }
    const territory = await readTerritory();
    const current: TileOccupation = territory[cellId] ?? { cellId, score: 0, lastEarnedAt: 0 };
    const earned = applyEarning(applyDecay(current, earnedAt), points, earnedAt);
    await writeTerritory({ ...territory, [cellId]: earned });
    const outcome: OccupationOutcome = {
      cellId,
      score: earned.score,
      occupied: isOccupied(earned),
    };
    setLastOccupation(outcome);
    return outcome;
  }

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextStatus: AppStateStatus) => {
      const current = stateRef.current;
      if (nextStatus === 'background') {
        dispatch({ type: 'APP_BACKGROUND', at: Date.now() });
        const isHardcoreActive =
          current.status !== 'idle' &&
          current.status !== 'finished' &&
          current.status !== 'failed_hardcore' &&
          current.mode === 'hardcore';
        if (isHardcoreActive) {
          cancelGraceTimer();
          graceTimerRef.current = setTimeout(() => {
            dispatch({ type: 'BACKGROUND_GRACE_EXPIRED', at: Date.now() });
          }, HARDCORE_GRACE_MS);
        }
      } else if (nextStatus === 'active') {
        cancelGraceTimer();
        dispatch({ type: 'APP_FOREGROUND', at: Date.now() });
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (state.status !== 'finished' && state.status !== 'failed_hardcore') {
      return;
    }
    void stopWatch();
    cancelGraceTimer();
    if (!persistedRef.current) {
      persistedRef.current = true;
      setLastSettlement(state.settlement);
      appendSessionEntry({
        id: `session-${state.startedAt}`,
        cellId: state.startCellId,
        mode: state.mode,
        startedAt: state.startedAt,
        endedAt: state.endedAt,
        creditedMs: state.settlement.creditedMs,
        points: state.settlement.points,
        endReason: state.endReason,
      }).catch((cause: unknown) => {
        setNotice('세션 기록 저장에 실패했습니다.');
        void cause;
      });
      reflectEarning(state.startCellId, state.settlement.points, state.endedAt).catch(
        (cause: unknown) => {
          setNotice('영토 점령 반영에 실패했습니다.');
          void cause;
        },
      );
    }
  }, [state]);

  useEffect(() => {
    if (state.status === 'idle' || TERMINAL_STATUSES.has(state.status)) {
      return;
    }
    const ticker = setInterval(() => setNowTick(Date.now()), 1_000);
    return () => clearInterval(ticker);
  }, [state.status]);

  useEffect(() => {
    return () => {
      cancelGraceTimer();
      void stopWatch();
    };
  }, []);

  return {
    status: state.status,
    mode: state.status === 'idle' ? null : state.mode,
    elapsedMs: elapsedMs(state, nowTick),
    snapshot,
    lastSettlement,
    lastOccupation,
    notice,
    actions: {
      start,
      pause,
      resume,
      end,
    },
  };
}
