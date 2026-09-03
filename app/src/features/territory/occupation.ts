/**
 * 영토 점령 순수 도메인(PRD §6-②, §6-③).
 * 단일 유저의 보유 스코어 누적·감쇠·점령 성립 판정만 다룬다.
 * 다유째 경쟁(영주 교체·선점 우선)은 서버 도입 시점 과제다.
 */
import {
  DAILY_DECAY_RATE,
  DECAY_CHECKPOINT_HOUR_KST,
  DECAY_INACTIVITY_WINDOW_MS,
  OCCUPATION_THRESHOLD,
} from './territory-policy';

const KST_OFFSET_MS = 9 * 3_600_000;
const DAY_MS = 86_400_000;

export interface TileOccupation {
  cellId: string;
  /** 감쇠가 반영된 현재 보유 스코어. */
  score: number;
  /** 이 타일에서 마지막으로 포인트를 획득한 시각(에포크 ms). */
  lastEarnedAt: number;
}

/** 세션 획득 점수를 타일 보유 스코어에 반영한다. */
export function applyEarning(
  tile: TileOccupation,
  points: number,
  earnedAt: number,
): TileOccupation {
  if (points <= 0) {
    return tile; // 0점 세션은 무활동 창 판정을 흔들지 않는다
  }
  return { ...tile, score: tile.score + points, lastEarnedAt: earnedAt };
}

/** 보유 스코어가 최소 점령 문턱 이상인가(§6-②). */
export function isOccupied(tile: TileOccupation): boolean {
  return tile.score >= OCCUPATION_THRESHOLD;
}

/**
 * 구간 (fromMs, toMs] 안의 감쇠 판정 시각(KST 04:00) 목록을 에포크 ms로 반환한다.
 * fromMs 자신이 판정 시각과 일치하면 그 판정은 이미 지난 것으로 제외한다.
 */
export function decayCheckpointsBetween(fromMs: number, toMs: number): number[] {
  const checkpoints: number[] = [];
  for (let cursor = firstCheckpointAfter(fromMs); cursor <= toMs; cursor += DAY_MS) {
    checkpoints.push(cursor);
  }
  return checkpoints;
}

/**
 * 마지막 획득 이후 지나간 감쇠 판정을 지연 반영한다(§6-③).
 * 판정 시점 T는 직전 24시간 (T-24h, T] 안에 획득이 있으면 감쇠하지 않는다.
 * 감쀴는 스코어만 내리고 lastEarnedAt은 그대로 둔다.
 */
export function applyDecay(tile: TileOccupation, nowMs: number): TileOccupation {
  if (tile.score <= 0) {
    return tile;
  }
  let score = tile.score;
  for (const checkpoint of decayCheckpointsBetween(tile.lastEarnedAt, nowMs)) {
    if (checkpoint - tile.lastEarnedAt < DECAY_INACTIVITY_WINDOW_MS) {
      continue; // 직전 24시간 내 획득 — 감쇠하지 않는다
    }
    score = Math.floor(score * (1 - DAILY_DECAY_RATE));
  }
  if (score === tile.score) {
    return tile;
  }
  return { ...tile, score };
}

function firstCheckpointAfter(t: number): number {
  // KST 달력의 그날 04:00을 찾은 뒤 UTC 에포크로 되돌린다
  const kstDayStart = Math.floor((t + KST_OFFSET_MS) / DAY_MS) * DAY_MS;
  const thatDayCheckpointKst = kstDayStart + DECAY_CHECKPOINT_HOUR_KST * 3_600_000;
  const firstKst =
    t + KST_OFFSET_MS < thatDayCheckpointKst ? thatDayCheckpointKst : thatDayCheckpointKst + DAY_MS;
  return firstKst - KST_OFFSET_MS;
}
