/**
 * 보호 구역 저장소 테스트 — AsyncStorage 모의.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { readPrivateZones, writePrivateZones } from './private-zone-store';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

describe('private-zone-store', () => {
  beforeEach(() => {
    jest.mocked(AsyncStorage.getItem).mockReset();
    jest.mocked(AsyncStorage.setItem).mockReset();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('빈 저장소는 빈 집합을 반환한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    expect(await readPrivateZones()).toEqual(new Set());
  });

  test('쓰면 셀 아이디 목록이 저장되고 왕복된다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify(['cell-a', 'cell-b']));
    const zones = await readPrivateZones();

    expect(zones.has('cell-a')).toBe(true);
    expect(zones.has('cell-b')).toBe(true);
    expect(zones.has('cell-c')).toBe(false);

    await writePrivateZones(zones);
    const saved = jest.mocked(AsyncStorage.setItem).mock.calls[0];
    expect(saved?.[0]).toBe('focus-turf/private-zone/v1');
    expect(JSON.parse(saved?.[1] ?? '[]')).toEqual(['cell-a', 'cell-b']);
  });

  test('저장소 오류는 호출자에게 전파된다', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('disk'));
    await expect(readPrivateZones()).rejects.toThrow('disk');
  });

  test('손상된 JSON도 예외로 전파한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('{not json');
    await expect(readPrivateZones()).rejects.toThrow();
  });
});
