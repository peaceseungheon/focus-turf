/**
 * react-native-unistyles 등록 — 진입점(index.ts)이 가장 먼저 불러온다.
 */
import { StyleSheet } from 'react-native-unistyles';

import { lightTheme } from './src/theme/themes';

declare module 'react-native-unistyles' {
  export interface UnistylesThemes {
    light: typeof lightTheme;
  }
}

StyleSheet.configure({
  settings: {
    initialTheme: 'light',
  },
  themes: {
    light: lightTheme,
  },
});
