/**
 * 위치 검증기(§6-④) — 샘플 열을 받아 지오펜스 이탈·이속 지속을 판정하는 순수 상태머신.
 *
 * 설계 계약(구현 계획 문서 참조):
 * - 확정은 소급(backdate)된다: 이탈/이속 확정 시각은 확인 시점이 아니라
 *   이탈·이속이 시작된 첫 샘플 시각이다. 리듀서는 이 시각에 가동 인터벌을 닫아
 *   미검증 구간이 인정 시간에 포함되지 않게 한다.
 * - 갭 가드: 연속 샘플 간격이 MAX_SEGMENT_GAP_MS 초과(또는 0 이하)면
 *   히스테리시스 닻과 속도 창을 초기화한다(백그라운드 복귀 등).
 */
import { cellAt, cellsAroundCell } from '../territory/tile';
import {
  EXIT_HYSTERESIS_MS,
  GEOFENCE_RING,
  MAX_SEGMENT_GAP_MS,
  SPEED_LIMIT_KMH,
  SPEED_SUSTAIN_MS,
} from './session-policy';

/** 위치 샘플. timestamp는 에포크 밀리초(expo-location LocationObject.timestamp). */
export interface Sample {
  lat: number;
  lng: number;
  timestamp: number;
}

/** UI 경고 표시용 현재 검증 상태. */
export interface VerifierSnapshot {
  cellId: string;
  isInside: boolean;
  outsideSince?: number;
  fastWindowMs: number;
  fastSince?: number;
  /** 마지막 유효 구간의 속도(km/h). 갭 등으로 계산 못 한 구간은 undefined. */
  speedKmh?: number;
}

export interface VerifierState {
  startCellId: string;
  fenceCells: string[];
  prevSample?: Sample;
  outsideSince?: number;
  fastSince?: number;
  fastWindowMs: number;
}

export interface VerifierDecision {
  state: VerifierState;
  snapshot: VerifierSnapshot;
  exitConfirmedAt?: number;
  speedConfirmedAt?: number;
}

const EARTH_RADIUS_M = 6_371_000;

/** 두 좌표 간 대권 거리(미터). */
function haversineMeters(a: Sample, b: Sample): number {
  const toRad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * toRad;
  const dLng = (b.lng - a.lng) * toRad;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function createVerifier(startCellId: string): VerifierState {
  return {
    startCellId,
    fenceCells: cellsAroundCell(startCellId, GEOFENCE_RING),
    fastWindowMs: 0,
  };
}

export function advanceVerifier(state: VerifierState, sample: Sample): VerifierDecision {
  const cellId = cellAt(sample);
  const isInside = state.fenceCells.includes(cellId);
  const dt =
    state.prevSample === undefined ? undefined : sample.timestamp - state.prevSample.timestamp;
  const isSegmentGap = dt !== undefined && (dt <= 0 || dt > MAX_SEGMENT_GAP_MS);

  let outsideSince: number | undefined;
  let exitConfirmedAt: number | undefined;
  if (isInside) {
    outsideSince = undefined;
  } else if (state.outsideSince === undefined || isSegmentGap) {
    outsideSince = sample.timestamp;
  } else {
    outsideSince = state.outsideSince;
    if (sample.timestamp - outsideSince >= EXIT_HYSTERESIS_MS) {
      exitConfirmedAt = outsideSince;
    }
  }

  let fastSince: number | undefined;
  let fastWindowMs = 0;
  let speedKmh: number | undefined;
  if (dt !== undefined && dt > 0 && dt <= MAX_SEGMENT_GAP_MS && state.prevSample !== undefined) {
    const meters = haversineMeters(state.prevSample, sample);
    speedKmh = (meters / (dt / 1000)) * 3.6;
    if (speedKmh >= SPEED_LIMIT_KMH) {
      fastSince = state.fastSince ?? state.prevSample.timestamp;
      fastWindowMs = state.fastWindowMs + dt;
    }
  }
  const speedConfirmedAt =
    fastSince !== undefined && fastWindowMs >= SPEED_SUSTAIN_MS ? fastSince : undefined;

  const next: VerifierState = {
    ...state,
    prevSample: sample,
    outsideSince,
    fastSince,
    fastWindowMs,
  };

  return {
    state: next,
    snapshot: { cellId, isInside, outsideSince, fastWindowMs, fastSince, speedKmh },
    exitConfirmedAt,
    speedConfirmedAt,
  };
}

/** 세션 재개 시 호출 — 닻과 속도 창만 지우고 prevSample은 갭 판정을 위해 유지한다. */
export function resetAccumulators(state: VerifierState): VerifierState {
  return { ...state, outsideSince: undefined, fastSince: undefined, fastWindowMs: 0 };
}
