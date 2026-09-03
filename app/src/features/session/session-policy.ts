/**
 * 집중 세션 정책 상수와 공용 타입 (PRD §6, §7, §11).
 * 모든 수치는 PRD의 초기 가설이며 베타 기간 튜닝 대상이다.
 */

/** 세션 모드 — 시작 시 확정되어 변경되지 않는다(§7). */
export type SessionMode = 'normal' | 'hardcore';

/** 포인트 산출(§6-② 가설): 노멀 분당 10점, 하드코어 분당 12점(1.2배). */
export const POINTS_PER_MINUTE: Readonly<Record<SessionMode, number>> = {
  normal: 10,
  hardcore: 12,
};

/** 세션 최소 인정 단위(§7): 1분 미만은 점수 미부여. */
export const MIN_CREDITED_MS = 60_000;

/** 위치 샘플링 주기(§11 가설): 세션 가동 중 15초. */
export const SAMPLE_INTERVAL_MS = 15_000;

/**
 * 지오펜스 허용 범위(§6-④ 가설: 20m)의 근사.
 * 시작 셀 포함 인접 1링을 허용 범위로 쓴다 — H3 res11 한 링은 변 길이 약 28.7m로
 * 실제 허용 폭은 위치에 따라 0~60m+로 변동하지만, GPS 오차(5~15m)를 감안해
 * 링 0(경계 0m 허용)보다 안전하다. 정밀화 필요 시 boundaryOf 기반 점-다각형 거리로 교체.
 */
export const GEOFENCE_RING = 1;

/** 히스테리시스(§6-④ 가설): 경계 이탈 상태가 60초 지속되어야 실제 이탈로 판정. */
export const EXIT_HYSTERESIS_MS = 60_000;

/** 이동 속도 임계(§6-④ 가설): 10km/h 이상이 지속되면 이동 중으로 본다. */
export const SPEED_LIMIT_KMH = 10;

/** 이속 지속 판정(§6-④ 가설): 임계 속도가 3분 이상 지속되면 타이머 일시정지. */
export const SPEED_SUSTAIN_MS = 180_000;

/** 하드코어 유예(§7 가설): 포그라운드 이탈 후 3분 내 복귀하지 않으면 세션 실패. */
export const HARDCORE_GRACE_MS = 180_000;

/**
 * 세그먼트 갭 상한(설계값): 연속 샘플 간격이 이 값을 넘으면(예: 백그라운드 복귀 직후)
 * 히스테리시스·속도 누적을 이어붙이지 않고 초기화한다.
 */
export const MAX_SEGMENT_GAP_MS = 120_000;

/**
 * 샘플 부재 판정(가설, §18 오픈 결정사항): 포그라운드 가동 중 이 시간 이상
 * 새 샘플이 없으면 위치 검증 불능으로 일시정지한다.
 */
export const SAMPLE_STALE_MS = 90_000;

/** 세션 상태 — 리듀서 상태머신의 전체 상태 집합. */
export type SessionStatus =
  | 'idle'
  | 'running'
  | 'paused_manual'
  | 'paused_geofence'
  | 'paused_speed'
  | 'paused_location'
  | 'failed_hardcore'
  | 'finished';

/** 종료 사유. */
export type EndReason = 'manual_end' | 'hardcore_fail' | 'below_minimum';
