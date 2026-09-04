/**
 * 디자인 토큰 정의 — 앱 전역 유일의 스타일 원천.
 * 색상 리터럴은 이 파일에만 존재한다(스택 지침: 스타일링·디자인 토큰).
 */
import { Platform } from 'react-native';

/**
 * 색약 대응(PRD §11): 영역색은 색상(색조)만으로 구분하지 않고 명도·채도 사다리로 구분한다.
 * 내 땅 청색(#3478F6, 명도 약 52) → 타인 땅 청록(#30B0C7, 약 66) → 보호 구역 호박색(#FFB300, 약 78)은
 * 명도가 최소 12 이상 떨어지고, 무주지 회색(#8E8E8E, 약 58)은 채도 0이라 유채색 셋과 채도로 구분된다.
 */
export const lightTheme = {
  colors: {
    background: '#FFFFFF',
    text: '#1C1B1F',
    // 본문 대비 명도가 충분히 낮은 회색조 — 색약 유저에게도 명도로만 구분된다
    textSecondary: '#5F6368',
    border: '#E0E0E0',
    warning: '#B3261E',
    territory: {
      mine: '#3478F6',
      others: '#30B0C7',
      neutral: '#8E8E8E',
      protected: '#FFB300',
      outline: '#1B4F9C',
    },
  },
  typography: {
    clock: {
      fontSize: 56,
      fontWeight: 'bold',
      // as const 객체 안 배열은 readonly가 되어 RN 타입(FontVariant[])에 안 맞으므로 가변 리터럴 배열로 단언
      fontVariant: ['tabular-nums'] as 'tabular-nums'[],
    },
    title: { fontSize: 18, fontWeight: 'bold' },
    subtitle: { fontSize: 16, fontWeight: 'bold' },
    body: { fontSize: 15 },
    caption: { fontSize: 13 },
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  insets: {
    // 지도 화면 상단 여백: iOS 노치/상태바, Android 상태바를 감안한 플랫폼 조건부 값이라 토큰으로 둔다
    mapScreenTop: Platform.select({ ios: 40, android: 8, default: 0 }),
  },
} as const;

/** 지도 SDK 색상 문자열은 #RRGGBB 뒤에 알파 바이트를 붙인 8자리 형식만 받는다 */
function withAlphaByte(hex: string, alphaByte: number): string {
  return `${hex}${alphaByte.toString(16).padStart(2, '0').toUpperCase()}`;
}

// 0xB3 ≈ 70% 불투명도 — Mapbox fillOpacity 0.7과 같은 겹침 세기
const OVERLAY_FILL_ALPHA_BYTE = 0xb3;

/**
 * 영역 폴리곤 파생색 — SDK별 색상 형식을 토큰 값에서 한 곳에서 유도한다.
 * Naver는 알파 포함 8자리, Mapbox는 6자리 + 레이어 opacity 조합만 받는다.
 */
export const territoryOverlayColors = {
  naver: {
    mineFill: withAlphaByte(lightTheme.colors.territory.mine, OVERLAY_FILL_ALPHA_BYTE),
    othersFill: withAlphaByte(lightTheme.colors.territory.others, OVERLAY_FILL_ALPHA_BYTE),
    outline: withAlphaByte(lightTheme.colors.territory.outline, 0xff),
  },
  mapbox: {
    mineFill: lightTheme.colors.territory.mine,
    othersFill: lightTheme.colors.territory.others,
    outline: lightTheme.colors.territory.outline,
  },
} as const;
