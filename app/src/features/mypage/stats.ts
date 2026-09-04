/**
 * 마이페이지 통계 순수 도메인(PRD §8 P0: 내 영토 & 통계).
 * 세션 로그와 영토 저장소의 데이터를 화면 표시용으로 집계한다.
 * 저장소 접근은 다루지 않는다 — 호출부(화면)가 경계다.
 */
import type { SessionLogEntry } from '../../services/storage/session-log';
import type { TerritoryMap } from '../../services/storage/territory-store';
import { isOccupied } from '../territory/occupation';

export interface SessionStats {
  /** 종료된 세션 수. */
  sessionCount: number;
  /** 누적 인정 집중 시간(ms). */
  creditedMs: number;
  /** 누적 획득 점수. */
  points: number;
}

export interface TileVisit {
  cellId: string;
  /** 해당 타일에서 종료한 세션 수. */
  visitCount: number;
  /** 해당 타일의 누적 인정 시간(ms). */
  creditedMs: number;
  /** 해당 타일의 누적 획득 점수. */
  points: number;
  /** 해당 타일에서 가장 최근에 종료한 세션의 종료 시각(에포크 ms). */
  lastVisitedAt: number;
}

/** 종료 세션 로그를 누적 통계로 합산한다. 정산값은 로그 기록을 그대로 신뢰한다. */
export function summarizeSessions(log: ReadonlyArray<SessionLogEntry>): SessionStats {
  let creditedMs = 0;
  let points = 0;
  for (const entry of log) {
    creditedMs += entry.creditedMs;
    points += entry.points;
  }
  return { sessionCount: log.length, creditedMs, points };
}

/**
 * 타일별 방문 이력을 '자주 방문한 거점' 순으로 정렬해 상위 limit개 반환한다.
 * 순위 기준: 방문 수 내림차순 → 최근 방문 시각 내림차순 → cellId 오름차순(안정화).
 */
export function tileVisitHistory(
  log: ReadonlyArray<SessionLogEntry>,
  limit: number,
): TileVisit[] {
  const byCell = new Map<string, TileVisit>();
  for (const entry of log) {
    const visit = byCell.get(entry.cellId);
    if (visit === undefined) {
      byCell.set(entry.cellId, {
        cellId: entry.cellId,
        visitCount: 1,
        creditedMs: entry.creditedMs,
        points: entry.points,
        lastVisitedAt: entry.endedAt,
      });
      continue;
    }
    visit.visitCount += 1;
    visit.creditedMs += entry.creditedMs;
    visit.points += entry.points;
    visit.lastVisitedAt = Math.max(visit.lastVisitedAt, entry.endedAt);
  }
  return [...byCell.values()]
    .sort((a, b) => {
      if (a.visitCount !== b.visitCount) {
        return b.visitCount - a.visitCount;
      }
      if (a.lastVisitedAt !== b.lastVisitedAt) {
        return b.lastVisitedAt - a.lastVisitedAt;
      }
      return a.cellId < b.cellId ? -1 : 1;
    })
    .slice(0, Math.max(limit, 0));
}

/** 현재 점령 중(보유 스코어가 최소 문턱 이상)인 타일 수를 센다(§6-②). */
export function countOccupiedTiles(territory: TerritoryMap): number {
  let count = 0;
  for (const tile of Object.values(territory)) {
    if (isOccupied(tile)) {
      count += 1;
    }
  }
  return count;
}
