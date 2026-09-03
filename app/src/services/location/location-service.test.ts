/**
 * 위치 샘플링 서비스 테스트 — expo-location 모의.
 */
import * as Location from 'expo-location';
import {
  getCurrentSample,
  requestWhenInUsePermission,
  startSampleWatch,
} from './location-service';

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  watchPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

function locationFix(timestamp: number, lat = 37.4979, lng = 127.0276) {
  return { coords: { latitude: lat, longitude: lng }, timestamp };
}

describe('location-service', () => {
  beforeEach(() => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockReset();
    jest.mocked(Location.getCurrentPositionAsync).mockReset();
    jest.mocked(Location.watchPositionAsync).mockReset();
  });

  test('권한 요청 결과를 granted/denied로 매핑한다', async () => {
    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      granted: true,
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    expect(await requestWhenInUsePermission()).toBe('granted');

    jest.mocked(Location.requestForegroundPermissionsAsync).mockResolvedValue({
      granted: false,
    } as Awaited<ReturnType<typeof Location.requestForegroundPermissionsAsync>>);
    expect(await requestWhenInUsePermission()).toBe('denied');
  });

  test('현재 위치를 Sample(lat,lng,timestamp)로 매핑한다', async () => {
    jest.mocked(Location.getCurrentPositionAsync).mockResolvedValue(locationFix(5_000) as never);
    const sample = await getCurrentSample();
    expect(sample).toEqual({ lat: 37.4979, lng: 127.0276, timestamp: 5_000 });
  });

  test('구독은 정책 주기(15초)·Balanced 정확도로 시작한다', async () => {
    const remove = jest.fn();
    jest.mocked(Location.watchPositionAsync).mockResolvedValue({ remove } as never);
    await startSampleWatch({ onSample: jest.fn(), onError: jest.fn() });

    const [options] = jest.mocked(Location.watchPositionAsync).mock.calls[0]!;
    expect(options.timeInterval).toBe(15_000);
    expect(options.distanceFilter).toBe(0);
    expect(options.accuracy).toBe(Location.Accuracy.Balanced);
  });

  test('구독 콜백은 LocationObject를 Sample로 변환해 전달한다', async () => {
    let push: ((loc: ReturnType<typeof locationFix>) => void) | undefined;
    jest.mocked(Location.watchPositionAsync).mockImplementation(
      (_options, callback) => {
        push = callback;
        return Promise.resolve({ remove: jest.fn() } as never);
      },
    );
    const onSample = jest.fn();
    await startSampleWatch({ onSample, onError: jest.fn() });

    push?.(locationFix(9_000, 37.5, 127.1));
    expect(onSample).toHaveBeenCalledWith({ lat: 37.5, lng: 127.1, timestamp: 9_000 });
  });
});
