/**
 * 영토 정책 상수 (PRD §6-②, §6-③).
 * 모든 수치는 PRD의 초기 가설이며 베타 기간 튜닝 대상이다(§18-4).
 */

/** 최소 점령 문턱(§6-② 가설): 보유 스코어 100점 이상부터 점령이 성립한다. */
export const OCCUPATION_THRESHOLD = 100;

/** 감쇠율(§6-③ 가설): 무활동 타일은 판정 시각마다 보유 스코어에서 15% 감소한다. */
export const DAILY_DECAY_RATE = 0.15;

/** 감쇠 판정 시각(§6-③): 매일 KST 04:00. KST는 서머타임 없는 UTC+9 고정 오프셋이다. */
export const DECAY_CHECKPOINT_HOUR_KST = 4;

/** 감쇠 무활동 창(§6-③): 판정 시점 직전 24시간 동안 획득이 없으면 감쇠한다. */
export const DECAY_INACTIVITY_WINDOW_MS = 24 * 60 * 60 * 1000;
