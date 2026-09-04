/**
 * 마이페이지 화면 — 누적 통계와 내 영토 요약(PRD §8 P0).
 * 저장소 예외는 이 화면이 경계다: 오류 문구로 대체 표시한다.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Button, SafeAreaView, ScrollView, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { readSessionLog } from '../../services/storage/session-log';
import { readTerritory } from '../../services/storage/territory-store';
import { countOccupiedTiles, summarizeSessions, tileVisitHistory } from './stats';

interface Props {
  onBack: () => void;
}

interface MyPageData {
  stats: ReturnType<typeof summarizeSessions>;
  occupiedTiles: number;
  visits: ReturnType<typeof tileVisitHistory>;
}

const TOP_VISITS_LIMIT = 5;

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.lg, gap: theme.spacing.md },
  title: { ...theme.typography.title, marginBottom: theme.spacing.xs },
  section: { ...theme.typography.subtitle, marginTop: theme.spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { ...theme.typography.body },
  statValue: { ...theme.typography.body, fontWeight: 'bold' },
  visitRow: {
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    gap: theme.spacing.xs,
  },
  visitTop: { flexDirection: 'row', justifyContent: 'space-between' },
  visitCell: { ...theme.typography.caption, color: theme.colors.textSecondary },
  empty: { ...theme.typography.caption, color: theme.colors.textSecondary },
  error: { ...theme.typography.body, color: theme.colors.warning },
}));

/** ms를 'X시간 Y분'(1시간 미만은 'Y분') 형식으로 표시한다. */
function formatDuration(totalMs: number): string {
  const totalMinutes = Math.floor(totalMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) {
    return `${minutes}분`;
  }
  return `${hours}시간 ${minutes}분`;
}

/** H3 셀 아이디를 표시용 짧은 라벨로 축약한다. */
function cellLabel(cellId: string): string {
  return `#${cellId.slice(0, 7)}`;
}

export function MyPageScreen({ onBack }: Props) {
  const [data, setData] = useState<MyPageData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [log, territory] = await Promise.all([readSessionLog(), readTerritory()]);
        if (cancelled) {
          return;
        }
        setData({
          stats: summarizeSessions(log),
          occupiedTiles: countOccupiedTiles(territory),
          visits: tileVisitHistory(log, TOP_VISITS_LIMIT),
        });
      } catch {
        if (!cancelled) {
          setError('기록을 불러오지 못했습니다.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Button title="← 홈" onPress={onBack} />
        <Text style={styles.title}>마이페이지</Text>
        {error !== null ? (
          <Text style={styles.error}>{error}</Text>
        ) : data === null ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            <Text style={styles.section}>누적 통계</Text>
            <View style={styles.row}>
              <Text style={styles.stat}>인정 집중 시간</Text>
              <Text style={styles.statValue}>{formatDuration(data.stats.creditedMs)}</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.stat}>획득 점수</Text>
              <Text style={styles.statValue}>{data.stats.points.toLocaleString('ko-KR')}점</Text>
            </View>
            <View style={styles.row}>
              <Text style={styles.stat}>완료 세션</Text>
              <Text style={styles.statValue}>{data.stats.sessionCount}회</Text>
            </View>
            <Text style={styles.section}>내 영토</Text>
            <View style={styles.row}>
              <Text style={styles.stat}>점령 중인 타일</Text>
              <Text style={styles.statValue}>{data.occupiedTiles}개</Text>
            </View>
            <Text style={styles.section}>자주 방문한 거점</Text>
            {data.visits.length === 0 ? (
              <Text style={styles.empty}>아직 기록이 없습니다. 첫 집중 세션을 시작해보세요.</Text>
            ) : (
              data.visits.map((visit) => (
                <View key={visit.cellId} style={styles.visitRow}>
                  <View style={styles.visitTop}>
                    <Text style={styles.statValue}>{cellLabel(visit.cellId)}</Text>
                    <Text style={styles.stat}>{visit.visitCount}회 방문</Text>
                  </View>
                  <Text style={styles.visitCell}>
                    {formatDuration(visit.creditedMs)} 집중 · {visit.points.toLocaleString('ko-KR')}점
                  </Text>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
