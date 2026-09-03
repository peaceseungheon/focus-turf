/**
 * 세션 로그 저장소 서비스 테스트 — AsyncStorage 모의.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { appendSessionEntry, readSessionLog, type SessionLogEntry } from './session-log';

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(),
  getItem: jest.fn(),
}));

function entry(id: string, overrides: Partial<SessionLogEntry> = {}): SessionLogEntry {
  return {
    id,
    mode: 'normal',
    startedAt: 1_000,
    endedAt: 61_000,
    creditedMs: 60_000,
    points: 10,
    endReason: 'manual_end',
    ...overrides,
  };
}

describe('session-log', () => {
  beforeEach(() => {
    jest.mocked(AsyncStorage.getItem).mockReset();
    jest.mocked(AsyncStorage.setItem).mockReset();
  });

  test('빈 저장소는 빈 배열을 반환한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
    expect(await readSessionLog()).toEqual([]);
  });

  test('추가하면 기존 로그 뒤에 붙고 저장된다(왕복)', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(null);
    await appendSessionEntry(entry('a'));
    const savedFirst = jest.mocked(AsyncStorage.setItem).mock.calls[0];
    expect(savedFirst).toBeDefined();

    jest.mocked(AsyncStorage.getItem).mockResolvedValueOnce(savedFirst?.[1] ?? null);
    await appendSessionEntry(entry('b'));
    const savedSecond = jest.mocked(AsyncStorage.setItem).mock.calls[1]?.[1];
    expect(savedSecond).toBeDefined();

    const parsed = JSON.parse(savedSecond ?? '[]') as SessionLogEntry[];
    expect(parsed.map((e) => e.id)).toEqual(['a', 'b']);
  });

  test('저장소 오류는 호출자에게 전파된다(무음 삼킴 없음)', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValue(new Error('disk'));
    await expect(readSessionLog()).rejects.toThrow('disk');
  });

  test('손상된 JSON도 예외로 전파한다', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('{not json');
    await expect(readSessionLog()).rejects.toThrow();
  });
});
