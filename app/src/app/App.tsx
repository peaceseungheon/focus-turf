import { useState } from 'react';
import { Button, SafeAreaView, ScrollView, Text } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { MapboxHexDemo } from '../features/map/MapboxHexDemo';
import { NaverHexDemo } from '../features/map/NaverHexDemo';
import { MyPageScreen } from '../features/mypage/MyPageScreen';
import { FocusTimerScreen } from '../features/session/FocusTimerScreen';

type Screen = 'home' | 'naver' | 'mapbox' | 'timer' | 'mypage';

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.sm },
  title: { ...theme.typography.title, marginBottom: theme.spacing.sm },
}));

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
  if (screen === 'mypage') {
    return <MyPageScreen onBack={() => setScreen('home')} />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Focus Turf — 기술 검증 Spike</Text>
        <Button title="집중 타이머 (위치 검증)" onPress={() => setScreen('timer')} />
        <Button title="마이페이지 (내 영토 & 통계)" onPress={() => setScreen('mypage')} />
        <Button title="네이버 지도 + H3 육각 오버레이" onPress={() => setScreen('naver')} />
        <Button title="Mapbox + H3 육각 오버레이" onPress={() => setScreen('mapbox')} />
      </ScrollView>
    </SafeAreaView>
  );
}
