/**
 * 세션 로그 로컬 저장소(AsyncStorage).
 * 손상된 저장값은 예외로 전파한다 — 세션 흐름이 아니라 경계에서 처리한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { EndReason, SessionMode } from '../../features/session/session-policy';

export interface SessionLogEntry {
  id: string;
  mode: SessionMode;
  startedAt: number;
  endedAt: number;
  creditedMs: number;
  points: number;
  endReason: EndReason;
}

const STORAGE_KEY = 'focus-turf/session-log/v1';

export async function readSessionLog(): Promise<ReadonlyArray<SessionLogEntry>> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return [];
  }
  return JSON.parse(raw) as SessionLogEntry[];
}

export async function appendSessionEntry(entry: SessionLogEntry): Promise<void> {
  const log = await readSessionLog();
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...log, entry]));
}
