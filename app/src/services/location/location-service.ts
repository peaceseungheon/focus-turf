/**
 * 위치 샘플링 서비스 — expo-location 래퍼.
 * MVP 권한은 '사용 중 위치'(When In Use)로 한정한다(PRD §8, §11).
 */
import * as Location from 'expo-location';
import type { Sample } from '../../features/session/location-verifier';
import { SAMPLE_INTERVAL_MS } from '../../features/session/session-policy';

export interface SampleCallbacks {
  onSample: (sample: Sample) => void;
  onError: (cause: unknown) => void;
}

export async function requestWhenInUsePermission(): Promise<'granted' | 'denied'> {
  const { granted } = await Location.requestForegroundPermissionsAsync();
  return granted ? 'granted' : 'denied';
}

export async function getCurrentSample(): Promise<Sample> {
  const position = await Location.getCurrentPositionAsync({});
  return {
    lat: position.coords.latitude,
    lng: position.coords.longitude,
    timestamp: position.timestamp,
  };
}

/** 15초 주기 포그라운드 구독. 반환값의 remove()로 해지한다. */
export async function startSampleWatch(
  callbacks: SampleCallbacks,
): Promise<Location.LocationSubscription> {
  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: SAMPLE_INTERVAL_MS,
      distanceFilter: 0,
    },
    (location) => {
      callbacks.onSample({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
        timestamp: location.timestamp,
      });
    },
  );
}
