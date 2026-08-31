# AGENTS.md

이 저장소에서 작업하는 에이전트의 진입점 문서다. 준수 기준이 되는 지침 문서는 `docs/guidelines/` 아래에 있으며, 이 문서는 작업 종류에 따라 어느 지침을 읽어야 하는지 안내한다.

## 1. 프로젝트 개요

이 저장소의 모바일 앱 스택은 2026-08-31 React Native + TypeScript로 확정되었다(백엔드 등 나머지 스택은 미정). 코드 작업을 시작하기 전에 반드시 스택 현황([스택 지침](docs/guidelines/stack/README.md))을 확인한다. 지침 문서 체계는 이 저장소에서 일하는 에이전트와 사람이 공동으로 준수하는 기준이다.

## 2. 지침 맵

| 문서 | 어떤 작업일 때 읽을지 |
| --- | --- |
| [지침 인덱스](docs/guidelines/README.md) | 지침 체계가 궁금할 때, 처음 시작할 때 |
| [설계 원칙](docs/guidelines/principles/design-principles.md) | 코드 설계, 구조 설계 작업 전 |
| [개발 원칙](docs/guidelines/principles/development-principles.md) | 모든 코드 작업 (테스트, 에러 처리, 보안, 작업 단위) |
| [코드 표준](docs/guidelines/principles/code-standards.md) | 코드 작성 전 (네이밍, 함수, 주석, 포맷) |
| [Git 워크플로우](docs/guidelines/version-control/git-workflow.md) | 브랜치, PR 작업 전 |
| [커밋 컨벤션](docs/guidelines/version-control/commit-conventions.md) | 커밋 작성 전 |
| [스택 지침](docs/guidelines/stack/README.md) | 특정 언어, 프레임워크 작업 시작 전, 반드시 여기부터 |
| [React Native 스택 지침](docs/guidelines/stack/react-native.md) | React Native·TypeScript 앱 코드 작업 전, 반드시 여기부터 |
| [스택 지침 양식](docs/guidelines/stack/_template.md) | 새 스택 지침 문서를 만들 때 쓰는 양식 |

## 3. 경계

### 항상

- 지침 문서를 준수한다.
- 버그픽스에는 재현 테스트를 동반한다.
- 커밋은 Conventional Commits 형식으로 작성한다.

### 질의

- 스택(언어, 프레임워크) 결정은 사용자에게 묻는다.
- 지침 변경이 필요하거나 지침 간 해석이 충돌하면 사용자에게 묻는다.
- 파괴적 작업(force push 등)은 사용자에게 확인한다.

### 금지

- 시크릿(키, 토큰, 비밀번호)을 커밋하지 않는다.
- main 브랜치에 직접 push하지 않는다.
- 지침을 무시한 임의 결정을 하지 않는다.

## 4. 스택 미정 시 행동

새 언어로 작업하기 전에 [스택 지침 안내](docs/guidelines/stack/README.md)의 절차를 따른다. 해당 언어의 스택 지침이 없으면 임의로 진행하지 않고, 사용자에게 [스택 지침 양식](docs/guidelines/stack/_template.md)으로 지침 생성을 먼저 제안한다.

## 5. 지침 갱신 지시

지침에 없는 상황을 만나면 임의로 판단하지 않고 사용자에게 질의한다. 질의 결과로 새 관행이 확립되면 해당 지침 문서를 먼저 갱신한 뒤 작업을 진행한다. 지침 갱신 자체는 [Git 워크플로우](docs/guidelines/version-control/git-workflow.md)의 PR 절차를 따른다.
