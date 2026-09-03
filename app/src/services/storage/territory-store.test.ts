/**
 * 영토 저장소 테스트 — AsyncStorage 모의.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { readTerritory, writeTerritory, type TerritoryMap } from './territory-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

/** KST 04:00 판정 시각 — Date.UTC(월은 0 기준)로 결정론적으로 만든다. */
function kst4(year: number, month1to12: number, day: number): number {
  return Date.UTC(year, month1to12 - 1, day - 1, 19, 0, 0);
}

describe('territory-store', () => {
  beforeEach(() => {
    jest.mocked(AsyncStorage.getItem).mockReset();
    jest.mocked(AsyncStorage.setItem).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('빈 저장소는 빈 맵을 반환한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    expect(await readTerritory()).toEqual({});
  });

  test('읽을 때 지난 감쇠 판정이 지연 반영된다', async () => {
    // 저장 시점엔 500점이었으나, 마지막 획득이 감쇠 판정 두 번 앞이다
    const stale = {
      cellId: 'cell-a',
      score: 500,
      lastEarnedAt: kst4(2026, 9, 2) - 60_000,
    };
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({ 'cell-a': stale }));
    jest.spyOn(Date, 'now').mockReturnValue(kst4(2026, 9, 4) + 3_600_000);

    const territory = await readTerritory();

    expect(territory['cell-a']?.score).toBe(361); // 500 → 425 → 361
    expect(territory['cell-a']?.lastEarnedAt).toBe(stale.lastEarnedAt);
  });

  test('쓰면 맵 전체가 저장된다(왕복)', async () => {
    const map: TerritoryMap = {
      'cell-a': { cellId: 'cell-a', score: 120, lastEarnedAt: kst4(2026, 9, 2) + 3_600_000 },
    };
    await writeTerritory(map);

    const saved = jest.mocked(AsyncStorage.setItem).mock.calls[0];
    expect(saved?.[0]).toBe('focus-turf/territory/v1');
    expect(JSON.parse(saved?.[1] ?? '{}')).toEqual(map);
  });

  test('저장소 오류는 호출자에게 전파된다(무음 삼킴 없음)', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('disk'));
    await expect(readTerritory()).rejects.toThrow('disk');
  });

  test('손상된 JSON도 예외로 전파한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('{not json');
    await expect(readTerritory()).rejects.toThrow();
  });
});
