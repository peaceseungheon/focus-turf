// @ts-check
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'node_modules/',
      'android/',
      'ios/',
      'expo-env.d.ts',
      'spike/**',
      // Expo config plugin은 prebuild가 require()로 로드하므로 CommonJS여야 한다.
      'plugins/**',
      // jest setupFiles는 변환 전 실행되는 환경이라 CommonJS를 쓴다.
      'jest.setup.js',
    ],
  },
  ...tseslint.configs.strict,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
    },
  },
);
