/**
 * 보호 구역 관리 화면(PRD §9) — 현재 위치 타일 지정·해제.
 * 지정 시 해당 타일의 점령 데이터는 점령 시스템에서 완전 제외(삭제)된다.
 * 해제해도 점령 스코어는 복구되지 않고 무주지로 새로 시작한다.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import {
  getCurrentSample,
  requestWhenInUsePermission,
} from '../../services/location/location-service';
import { readPrivateZones, writePrivateZones } from '../../services/storage/private-zone-store';
import { readTerritory, writeTerritory, type TerritoryMap } from '../../services/storage/territory-store';
import { protectZone, unprotectZone } from './private-zone';
import { cellAt, cellLabel } from './tile';

interface Props {
  onBack: () => void;
}

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, marginBottom: theme.spacing.xs },
  description: { ...theme.typography.caption, color: theme.colors.textSecondary },
  zoneRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  zoneCell: { ...theme.typography.body, fontWeight: 'bold' },
  empty: { ...theme.typography.caption, color: theme.colors.textSecondary },
  error: { ...theme.typography.body, color: theme.colors.warning },
}));

export function PrivateZoneScreen({ onBack }: Props) {
  const [zones, setZones] = useState<ReadonlySet<string> | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readPrivateZones()
      .then(setZones)
      .catch(() => setError('보호 구역 목록을 불러오지 못했습니다.'));
  }, []);

  async function protectCurrentTile(): Promise<void> {
    setNotice(null);
    setError(null);
    try {
      const permission = await requestWhenInUsePermission();
      if (permission === 'denied') {
        setNotice('위치 권한이 필요합니다. 설정에서 위치 접근을 허용해 주세요.');
        return;
      }
      const cell = cellAt(await getCurrentSample());
      const current = await readPrivateZones();
      if (current.has(cell)) {
        setNotice('이 타일은 이미 보호 구역입니다.');
        return;
      }
      await writePrivateZones(protectZone(current, cell));
      const territory = await readTerritory();
      if (territory[cell] !== undefined) {
        const next: TerritoryMap = {};
        for (const [id, tile] of Object.entries(territory)) {
          if (id !== cell) {
            next[id] = tile;
          }
        }
        await writeTerritory(next);
      }
      setZones(protectZone(current, cell));
      setNotice(`${cellLabel(cell)} 타일을 보호 구역으로 지정했습니다.`);
    } catch {
      setError('보호 구역 지정에 실패했습니다.');
    }
  }

  async function unprotect(cell: string): Promise<void> {
    setNotice(null);
    setError(null);
    try {
      const current = await readPrivateZones();
      await writePrivateZones(unprotectZone(current, cell));
      setZones(unprotectZone(current, cell));
    } catch {
      setError('보호 구역 해제에 실패했습니다.');
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Button title="← 홈" onPress={onBack} />
        <Text style={styles.title}>보호 구역 설정</Text>
        <Text style={styles.description}>
          보호 구역으로 지정된 타일은 점령 시스템에서 완전히 제외됩니다. 해당 타일의 집중 기록은
          개인 통계에만 반영되고, 지정 시점의 점령 스코어는 삭제됩니다(해제해도 복구되지 않습니다).
        </Text>
        <Button title="현재 위치 타일 보호 구역으로 지정" onPress={() => void protectCurrentTile()} />
        {notice !== null && <Text style={styles.description}>{notice}</Text>}
        {error !== null && <Text style={styles.error}>{error}</Text>}
        {zones === null ? (
          error === null && <ActivityIndicator size="large" />
        ) : zones.size === 0 ? (
          <Text style={styles.empty}>지정된 보호 구역이 없습니다.</Text>
        ) : (
          [...zones].map((cell) => (
            <View key={cell} style={styles.zoneRow}>
              <Text style={styles.zoneCell}>{cellLabel(cell)}</Text>
              <Button title="해제" onPress={() => void unprotect(cell)} />
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
