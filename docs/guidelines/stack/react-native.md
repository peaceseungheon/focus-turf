# React Native 스택 지침

## 개요

Focus Turf 모바일 앱의 UI와 클라이언트 로직 전반을 React Native + TypeScript로 작성한다. 2026-08-31 사용자 결정으로 확정했으며 결정 근거와 대안 비교는 [../../plan/tech-stack-comparison.md](../../plan/tech-stack-comparison.md) §8를 참고한다. 이 문서는 React Native·TypeScript 코드 작업 전 반드시 읽는 기준이며, 지도 SDK 선정(PRD §18-2)과 백엔드 스택은 이 문서의 범위 밖이다.

## 버전·도구체인

- **React Native 0.87.x** — New Architecture(Fabric·TurboModules/JSI)가 기본 전제다. Old Architecture로의 비활성화를 금지한다.
- **TypeScript 5.x** — `strict: true` 필수.
- **Node 22 LTS** — `.nvmrc`와 `package.json`의 `engines`로 고정한다.
- **패키지 매니저 npm** — lockfile(package-lock.json)을 커밋하고 다른 매니저를 혼용하지 않는다.
- **워크플로: Expo(managed + dev client)를 기본 방침으로 한다.** 네이티브 모듈(지도 SDK 래퍼 등)의 Expo 호환성은 기술 검증 Spike에서 확인한 뒤 확정한다. Expo가 성립하지 않아 bare RN으로 전환할 때는 이 문서를 먼저 갱신한다.
- 정확한 버전은 프로젝트 초기화 커밋에서 lockfile로 고정한다.

## 프로젝트 구조 규약

앱 코드는 초기화 시 생성하는 앱 루트 디렉터리 아래 `src/`에 둔다. 기본 골격은 다음과 같다.

```
app/
  src/
    app/          # 라우팅, 진입점, 화면 조합
    features/     # 도메인별 기능 (map, timer, territory, auth, ...)
    components/   # 공통 UI 컴포넌트
    services/     # 플랫폼 연동 (location, notifications, storage)
    native/       # 네이티브 모듈 래퍼 (TurboModules)
    store/        # 상태 관리
    types/        # 공통 타입 정의
    utils/        # 순수 유틸리티
```

- 도메인 로직(H3 셀 판정, 감쇠 계산, 점수 산출 등)은 `features/` 안의 순수 TypeScript 모듈로 두고 네이티브·UI 의존 없이 작성한다(단위 테스트 용이성).
- 신규 파일은 속한 계층에 배치하고, 애매한 경우 `features/`를 우선한다.

## 네이밍 표기 규칙

| 대상 | 표기 | 예 |
| --- | --- | --- |
| 파일(컴포넌트·화면) | PascalCase.tsx | `TerritoryMapScreen.tsx` |
| 파일(컴포넌트 외 모듈) | kebab-case.ts | `focus-score.ts` |
| 테스트 파일 | 대상 파일명 + `.test.ts(x)` | `focus-score.test.ts` |
| 타입·인터페이스·클래스·컴포넌트 | PascalCase (I·T 접두사 없음) | `FocusSession` |
| 함수·변수 | camelCase | `calculateDecay` |
| React 훅 | `use` 접두사 + camelCase | `useFocusTimer` |
| 상수 | UPPER_SNAKE_CASE | `DAILY_DECAY_RATE` |
| 불리언 | is/has/can 접두사 | `isForeground` |

이름만 읽어도 의도가 드러나야 한다는 공통 원칙은 [../principles/code-standards.md](../principles/code-standards.md)를 우선으로 준수한다.

## 포맷·린트 도구와 설정

- **Prettier**(포맷) + **ESLint**(typescript-eslint, flat config)를 사용한다.
- 설정 파일(`.prettierrc`, `eslint.config.js`)은 앱 루트에 두고 프로젝트 초기화 시 생성한다.
- 주요 규칙: `@typescript-eslint` strict 계열, `no-floating-promises`, `no-explicit-any`(error).
- 실행: `npm run lint`, `npm run lint:fix`.

## 테스트 프레임워크와 실행 명령

- **Jest**(단위·통합) + **React Native Testing Library**(컴포넌트)를 사용한다.
- 테스트 위치: 대상 파일과 같은 디렉터리에 `.test.ts(x)`로 함께 둔다(colocate).
- 순수 도메인 로직(H3 판정, 감쇠, 점수 산출)은 테스트 작성 대상이다(개발 원칙: 핵심 로직 강한 권장).
- 실행: `npm test`(전체), `npm test -- focus-score`(단일).
- 버그 수정은 실패하는 재현 테스트를 먼저 작성한다(개발 원칙 필수).

## 빌드·실행 명령

프로젝트 초기화 시 아래 스크립트 체계를 `package.json`에 갖춘다.

- `npm run typecheck` — `tsc --noEmit`
- `npm run lint` — ESLint
- `npm test` — Jest
- `npm start` — Expo 개발 서버(Expo 확정 시)
- Android/iOS 빌드 — EAS Build 또는 로컬 빌드(초기화 시 확정)

커밋 전에 typecheck·lint·test를 통과하는 것이 기본이다.

## 의존성 관리 규칙

- 의존성 추가 전 필수 확인: (1) New Architecture 호환 여부 (2) 최근 12개월 내 릴리즈(유지보수 상태) (3) RN 0.87 호환.
- 네이티브 코드를 포함하는 패키지(지도 SDK 래퍼 등)는 기술 검증(Spike)을 거친 뒤 추가한다.
- 유료 라이선스 패키지(예: TransistorSoft 계열 백그라운드 위치)는 사용자 승인 후에만 추가한다.
- npm 외 매니저로 설치하지 않고, lockfile 갱신 없이 커밋하지 않는다.
- 미사용 의존성은 확인 즉시 제거한다.

## 언어 특화 안티패턴

| 금지 | 이유 | 대안 |
| --- | --- | --- |
| `any`, `@ts-ignore`, 근거 없는 타입 단언 | 타입 안전 붕괴 | 정확한 타입 정의, 제네릭, 판별 유니언 |
| JS 타이머(`setTimeout` 등)로 백그라운드 타이머 구현 | 화면 꺼짐 시 정지함(PRD §11 위반) | 네이티브 모듈(포그라운드 서비스 등) 경유 + 로컬 저장 상태 복원 |
| `react-native-maps` 폴리곤 오버레이로 육각 그리드 구현 | Fabric(Android) 렌더링 이슈(react-native-maps#5932) | 네이티브 맵 SDK 래퍼의 폴리곤 오버레이만 사용 |
| bridge 기반 Old Architecture 네이티브 모듈 신규 작성 | 0.82+에서 제거된 표준과 불일치 | TurboModules(JSI) 기반 작성 |
| OS 지오펜싱으로 타일 경계 판정 구현 | OS별 개수 한도·배터리 제약, 요구와 불일치 | 포그라운드 샘플링 + H3 셀 판정 연산(tech-stack-comparison.md §3) |
| Hermes 호환 미확인 API 사용(Intl 일부 등) | 런타임 오류 | 사용 전 Hermes 호환 확인 |
| 백그라운드 위치 권한을 기본(필수) 요구 | 심사 리젝 사유, PRD §11 정책 위반 | '사용 중 위치'를 필수로, 백그라운드 위치는 선택 권한으로 안내 |
