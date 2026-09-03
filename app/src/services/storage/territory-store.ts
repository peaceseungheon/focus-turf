/**
 * 영토 점령 상태 로컬 저장소(AsyncStorage).
 * 읽을 때 지난 감쇠 판정을 지연 반영한다(판정 시각에 깨어 있을 수 없는 로컬 구조의 대응).
 * 손상된 저장값은 예외로 전파한다 — 세션 흐름이 아니라 경계에서 처리한다.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { applyDecay, type TileOccupation } from '../../features/territory/occupation';

const STORAGE_KEY = 'focus-turf/territory/v1';

export type TerritoryMap = Record<string, TileOccupation>;

export async function readTerritory(): Promise<TerritoryMap> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (raw === null) {
    return {};
  }
  const stored = JSON.parse(raw) as TerritoryMap;
  const now = Date.now();
  const territory: TerritoryMap = {};
  for (const [cellId, tile] of Object.entries(stored)) {
    territory[cellId] = applyDecay(tile, now);
  }
  return territory;
}

export async function writeTerritory(territory: TerritoryMap): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(territory));
}
