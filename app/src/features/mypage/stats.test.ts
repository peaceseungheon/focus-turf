/**
 * 마이페이지 통계 도메인 테스트 — 빈 로그, 합산, 거점 순위, 점령 문턱 경계.
 */
import type { SessionLogEntry } from '../../services/storage/session-log';
import {
  countOccupiedTiles,
  summarizeSessions,
  tileVisitHistory,
} from './stats';
import type { TerritoryMap } from '../../services/storage/territory-store';

let nextId = 0;

function makeEntry(partial: Partial<SessionLogEntry> = {}): SessionLogEntry {
  nextId += 1;
  return {
    id: `session-${nextId}`,
    cellId: '892a100b26fffff',
    mode: 'normal',
    startedAt: 0,
    endedAt: 1_000,
    creditedMs: 1_000,
    points: 10,
    endReason: 'manual_end',
    ...partial,
  };
}

describe('summarizeSessions', () => {
  it('빈 로그는 모두 0이다', () => {
    expect(summarizeSessions([])).toEqual({ sessionCount: 0, creditedMs: 0, points: 0 });
  });

  it('세션 수·인정 시간·점수를 합산한다', () => {
    const log = [
      makeEntry({ creditedMs: 60_000, points: 10 }),
      makeEntry({ cellId: '892a100b2fffffff', creditedMs: 120_000, points: 20 }),
      makeEntry({ creditedMs: 0, points: 0, endReason: 'below_minimum' }),
    ];
    expect(summarizeSessions(log)).toEqual({
      sessionCount: 3,
      creditedMs: 180_000,
      points: 30,
    });
  });
});

describe('tileVisitHistory', () => {
  it('타일별 방문 수·인정 시간·최근 방문 시각을 집계한다', () => {
    const history = tileVisitHistory(
      [
        makeEntry({ cellId: 'cell-a', endedAt: 1_000, creditedMs: 60_000, points: 10 }),
        makeEntry({ cellId: 'cell-a', endedAt: 3_000, creditedMs: 30_000, points: 5 }),
      ],
      5,
    );
    expect(history).toEqual([
      { cellId: 'cell-a', visitCount: 2, creditedMs: 90_000, points: 15, lastVisitedAt: 3_000 },
    ]);
  });

  it('방문 수가 많은 타일이 우선한다', () => {
    const history = tileVisitHistory(
      [
        makeEntry({ cellId: 'cell-once', endedAt: 9_000 }),
        makeEntry({ cellId: 'cell-twice', endedAt: 1_000 }),
        makeEntry({ cellId: 'cell-twice', endedAt: 2_000 }),
      ],
      5,
    );
    expect(history.map((visit) => visit.cellId)).toEqual(['cell-twice', 'cell-once']);
  });

  it('방문 수가 같으면 최근에 방문한 타일이 우선한다', () => {
    const history = tileVisitHistory(
      [
        makeEntry({ cellId: 'cell-old', endedAt: 1_000 }),
        makeEntry({ cellId: 'cell-new', endedAt: 5_000 }),
      ],
      5,
    );
    expect(history.map((visit) => visit.cellId)).toEqual(['cell-new', 'cell-old']);
  });

  it('limit만큼만 반환한다', () => {
    const history = tileVisitHistory(
      [
        makeEntry({ cellId: 'cell-a' }),
        makeEntry({ cellId: 'cell-b' }),
        makeEntry({ cellId: 'cell-c' }),
      ],
      2,
    );
    expect(history).toHaveLength(2);
  });
});

describe('countOccupiedTiles', () => {
  it('최소 점령 문턱 이상인 타일만 센다', () => {
    const territory: TerritoryMap = {
      occupied: { cellId: 'occupied', score: 100, lastEarnedAt: 0 },
      below: { cellId: 'below', score: 99, lastEarnedAt: 0 },
      zero: { cellId: 'zero', score: 0, lastEarnedAt: 0 },
    };
    expect(countOccupiedTiles(territory)).toBe(1);
  });

  it('빈 영토는 0이다', () => {
    expect(countOccupiedTiles({})).toBe(0);
  });
});
