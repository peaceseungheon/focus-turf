/**
 * 보호 구역 로컬 저장소(AsyncStorage).
 * 손상된 저장값은 예외로 전파한다 — 세션 흐름이 아니라 경계에서 처리한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import type { PrivateZones } from '../../features/territory/private-zone';

const STORAGE_KEY = 'focus-turf/private-zone/v1';

export async function readPrivateZones(): Promise<PrivateZones> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return new Set();
  }
  return new Set(JSON.parse(raw) as string[]);
}

export async function writePrivateZones(zones: PrivateZones): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...zones]));
}
