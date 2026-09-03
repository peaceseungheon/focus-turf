import { useState } from 'react';
import { Button, SafeAreaView, ScrollView, StyleSheet, Text } from 'react-native';

import { MapboxHexDemo } from '../features/map/MapboxHexDemo';
import { NaverHexDemo } from '../features/map/NaverHexDemo';
import { FocusTimerScreen } from '../features/session/FocusTimerScreen';

type Screen = 'home' | 'naver' | 'mapbox' | 'timer';

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 16, gap: 8 },
  title: { fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
});

export default function App() {
  const [screen, setScreen] = useState<Screen>('home');

  if (screen === 'naver') {
    return <NaverHexDemo onBack={() => setScreen('home')} />;
  }
  if (screen === 'mapbox') {
    return <MapboxHexDemo onBack={() => setScreen('home')} />;
  }
  if (screen === 'timer') {
    return <FocusTimerScreen onBack={() => setScreen('home')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Focus Turf — 기술 검증 Spike</Text>
        <Button title="집중 타이머 (위치 검증)" onPress={() => setScreen('timer')} />
        <Button title="네이버 지도 + H3 육각 오버레이" onPress={() => setScreen('naver')} />
        <Button title="Mapbox + H3 육각 오버레이" onPress={() => setScreen('mapbox')} />
      </ScrollView>
    </SafeAreaView>
  );
}
