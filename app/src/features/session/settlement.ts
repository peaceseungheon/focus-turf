/**
 * 세션 정산 순수 로직(§6-②, §7).
 * 타임라인(가동 인터벌 목록)만 입력받아 인정 시간과 포인트를 계산한다.
 */
import { MIN_CREDITED_MS, POINTS_PER_MINUTE, type SessionMode } from './session-policy';

export interface TimelineInterval {
  startMs: number;
  /** 열린 인터벌(가동 중)은 생략 — endedAt이 주어지면 그 시각으로 닫아 정산한다. */
  endMs?: number;
}

export interface SettlementResult {
  creditedMs: number;
  creditedMinutes: number;
  points: number;
  mode: SessionMode;
  /** 1분 미만으로 0점이 된 경우에만 존재한다. */
  zeroReason?: 'below_minimum';
}

/** 가동 인터벌 목록을 정산한다. 열린 마지막 인터벌은 endedAt으로 닫는다. */
export function settle(
  intervals: ReadonlyArray<TimelineInterval>,
  mode: SessionMode,
  endedAt?: number,
): SettlementResult {
  const creditedMs = intervals.reduce((sum, interval) => {
    const end = interval.endMs ?? endedAt;
    if (end === undefined) {
      return sum;
    }
    // 기기 시계 보정 등으로 음수가 되는 것을 방지한다
    return sum + Math.max(0, end - interval.startMs);
  }, 0);

  const belowMinimum = creditedMs < MIN_CREDITED_MS;
  const points = belowMinimum
    ? 0
    : Math.floor((creditedMs / MIN_CREDITED_MS) * POINTS_PER_MINUTE[mode]);

  return {
    creditedMs,
    creditedMinutes: Math.floor(creditedMs / MIN_CREDITED_MS),
    points,
    mode,
    zeroReason: belowMinimum ? 'below_minimum' : undefined,
  };
}
