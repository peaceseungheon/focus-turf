import { NaverMapPolygonOverlay, NaverMapView } from '@mj-studio/react-native-naver-map';
import { useMemo, useState } from 'react';
import { Button, Platform, StyleSheet, Text, View } from 'react-native';

import { boundaryOf, cellsAround } from '../territory/tile';

const GANGNAM_STATION = { lat: 37.4979, lng: 127.0276 };

interface Props {
  onBack: () => void;
}

const styles = StyleSheet.create({
  container: { flex: 1, marginTop: Platform.select({ ios: 40, android: 8, default: 0 }) },
  map: { flex: 1 },
  controls: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { fontSize: 13 },
});

/** 래퍼 요구사항: coords는 닫힌 링(첫 좌표 == 끝 좌표)이어야 한다. */
function toClosedRing(cell: string) {
  const vertices = boundaryOf(cell).map(({ lat, lng }) => ({ latitude: lat, longitude: lng }));
  const first = vertices[0];
  if (first === undefined) {
    throw new Error(`H3 셀 ${cell}의 경계가 비어 있다`);
  }
  return [...vertices, first];
}

export function NaverHexDemo({ onBack }: Props) {
  const [radius, setRadius] = useState(5);

  const overlays = useMemo(
    () =>
      cellsAround(GANGNAM_STATION, radius).map((cell, index) => ({
        cell,
        coords: toClosedRing(cell),
        color: index % 3 === 0 ? '#3478F6B3' : '#30B0C7B3',
      })),
    [radius],
  );

  return (
    <View style={styles.container}>
      <NaverMapView
        style={styles.map}
        camera={{
          latitude: GANGNAM_STATION.lat,
          longitude: GANGNAM_STATION.lng,
          zoom: 16,
        }}
      >
        {overlays.map((overlay) => (
          <NaverMapPolygonOverlay
            key={overlay.cell}
            coords={overlay.coords}
            color={overlay.color}
            outlineColor="#1B4F9CFF"
            outlineWidth={1}
          />
        ))}
      </NaverMapView>
      <View style={styles.controls}>
        <Button title="←" onPress={onBack} />
        <Text style={styles.label}>육각 {overlays.length}개 (반지름 {radius})</Text>
        <Button title="확대" onPress={() => setRadius((r) => Math.min(r + 5, 30))} />
        <Button title="축소" onPress={() => setRadius((r) => Math.max(r - 5, 0))} />
      </View>
    </View>
  );
}
