import Mapbox from '@rnmapbox/maps';
import { useMemo, useState } from 'react';
import { Button, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { territoryOverlayColors } from '../../theme/themes';
import { boundaryOf, cellsAround } from '../territory/tile';

const GANGNAM_STATION = { lat: 37.4979, lng: 127.0276 };

interface Props {
  onBack: () => void;
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1 },
  map: { flex: 1 },
  controls: {
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    gap: theme.spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  label: { ...theme.typography.caption },
}));

void Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_TOKEN ?? '');

export function MapboxHexDemo({ onBack }: Props) {
  const [radius, setRadius] = useState(5);

  const hexCollection = useMemo(() => {
    const features = cellsAround(GANGNAM_STATION, radius).map((cell, index) => {
      const ring = boundaryOf(cell).map(({ lng, lat }) => [lng, lat] as [number, number]);
      const first = ring[0];
      if (first === undefined) {
        throw new Error(`H3 셀 ${cell}의 경계가 비어 있다`);
      }
      return {
        type: 'Feature' as const,
        id: cell,
        properties: { ownerClass: index % 3 },
        geometry: {
          type: 'Polygon' as const,
          // GeoJSON은 닫힌 링과 [경도, 위도] 순서를 요구한다
          coordinates: [[...ring, first]],
        },
      };
    });
    return { type: 'FeatureCollection' as const, features };
  }, [radius]);

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map}>
        <Mapbox.Camera
          centerCoordinate={[GANGNAM_STATION.lng, GANGNAM_STATION.lat]}
          zoomLevel={16}
        />
        <Mapbox.ShapeSource id="hex-territory" shape={hexCollection}>
          <Mapbox.FillLayer
            id="hex-fill"
            style={{
              fillOpacity: 0.7,
              fillColor: [
                'match',
                ['get', 'ownerClass'],
                0,
                territoryOverlayColors.mapbox.mineFill,
                territoryOverlayColors.mapbox.othersFill,
              ],
            }}
          />
          <Mapbox.LineLayer
            id="hex-outline"
            style={{ lineColor: territoryOverlayColors.mapbox.outline, lineWidth: 1 }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
      <View style={styles.controls}>
        <Button title="←" onPress={onBack} />
        <Text style={styles.label}>육각 {hexCollection.features.length}개 (반지름 {radius})</Text>
        <Button title="확대" onPress={() => setRadius((r) => Math.min(r + 5, 30))} />
        <Button title="축소" onPress={() => setRadius((r) => Math.max(r - 5, 0))} />
      </View>
    </View>
  );
}
