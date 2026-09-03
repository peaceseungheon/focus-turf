/**
 * 집중 타이머 화면 — 세션 시작/정지/재개와 검증 상태 표시.
 */
import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';

import { useFocusSession } from './use-focus-session';
import type { SessionMode } from './session-policy';

interface Props {
  onBack: () => void;
}

type ModeSelection = SessionMode;

const MODE_LABEL: Record<ModeSelection, string> = {
  normal: '노멀',
  hardcore: '하드코어 (1.2배)',
};

const AUTO_PAUSE_MESSAGE: Record<string, string> = {
  paused_geofence: '타일을 이탈해 자동 일시정지됐습니다. 타일로 돌아와 재개하세요.',
  paused_speed: '이동이 감지되어 자동 일시정지됐습니다. 정지 후 재개하세요.',
  paused_location: '위치 신호를 확인하지 못해 일시정지됐습니다. 위치를 확인한 뒤 재개하세요.',
};

const styles = StyleSheet.create((theme) => ({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: {
    flex: 1,
    padding: theme.spacing.xl,
    gap: theme.spacing.md,
    justifyContent: 'center',
  },
  modeRow: { flexDirection: 'row', gap: theme.spacing.sm, alignItems: 'center' },
  elapsed: { ...theme.typography.clock, textAlign: 'center' },
  status: { ...theme.typography.body, textAlign: 'center' },
  warning: { ...theme.typography.caption, color: theme.colors.warning, textAlign: 'center' },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: theme.spacing.md },
  settlement: { padding: theme.spacing.lg, gap: theme.spacing.xs, alignItems: 'center' },
  settlementTitle: { ...theme.typography.subtitle },
}));

function formatClock(totalMs: number): string {
  const totalSeconds = Math.floor(totalMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function FocusTimerScreen({ onBack }: Props) {
  const { status, mode, elapsedMs, snapshot, lastSettlement, lastOccupation, notice, actions } =
    useFocusSession();
  const [selectedMode, setSelectedMode] = useState<ModeSelection>('normal');

  const isIdle = status === 'idle';
  const isTerminal = status === 'finished' || status === 'failed_hardcore';
  const isManualPaused = status === 'paused_manual';
  const autoPauseMessage = AUTO_PAUSE_MESSAGE[status];
  const canResumeFromAutoPause =
    (status === 'paused_geofence' && snapshot?.isInside === true) ||
    (status === 'paused_speed' && snapshot !== null) ||
    (status === 'paused_location' && snapshot !== null);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {isIdle ? (
          <>
            <Text style={styles.status}>집중할 모드를 선택하세요</Text>
            <View style={styles.modeRow}>
              <Button
                title={MODE_LABEL[selectedMode]}
                onPress={() => setSelectedMode(selectedMode === 'normal' ? 'hardcore' : 'normal')}
              />
              <Button title="시작" onPress={() => void actions.start(selectedMode)} />
            </View>
          </>
        ) : isTerminal ? (
          <View style={styles.settlement}>
            <Text style={styles.settlementTitle}>
              {status === 'failed_hardcore' ? '하드코어 실패' : '세션 종료'}
            </Text>
            <Text>점수 {lastSettlement?.points ?? 0}점</Text>
            <Text>인정 시간 {formatClock(lastSettlement?.creditedMs ?? 0)}</Text>
            {lastOccupation !== null && (
              <Text>
                타일 보유 {lastOccupation.score}점 ·{' '}
                {lastOccupation.occupied ? '점령 중' : '무주지(문턱 100점)'}
              </Text>
            )}
            {lastSettlement?.zeroReason === 'below_minimum' && (
              <Text style={styles.warning}>1분 미만은 점수가 부여되지 않습니다</Text>
            )}
            <Button title="새 세션" onPress={() => void actions.start(mode ?? 'normal')} />
          </View>
        ) : (
          <>
            <Text style={styles.status}>
              {MODE_LABEL[mode ?? 'normal']} · {isManualPaused || autoPauseMessage ? '일시정지' : '집중 중'}
            </Text>
            <Text style={styles.elapsed}>{formatClock(elapsedMs)}</Text>
            {autoPauseMessage !== undefined && <Text style={styles.warning}>{autoPauseMessage}</Text>}
            {status === 'running' && snapshot !== null && !snapshot.isInside && (
              <Text style={styles.warning}>타일 경계 밖 — 60초 내 복귀하지 않으면 자동 일시정지됩니다</Text>
            )}
            {snapshot !== null && (
              <Text style={styles.status}>
                {snapshot.isInside ? '타일 내부' : '타일 외부'}
                {snapshot.speedKmh !== undefined && ` · ${snapshot.speedKmh.toFixed(1)}km/h`}
              </Text>
            )}
            <View style={styles.controls}>
              <Button title="←" onPress={onBack} />
              {status === 'running' && <Button title="일시정지" onPress={actions.pause} />}
              {isManualPaused && <Button title="재개" onPress={actions.resume} />}
              {autoPauseMessage !== undefined && canResumeFromAutoPause && (
                <Button title="재개" onPress={actions.resume} />
              )}
              <Button title="종료" onPress={() => void actions.end()} />
            </View>
          </>
        )}
        {notice !== null && <Text style={styles.warning}>{notice}</Text>}
      </View>
    </View>
  );
}
