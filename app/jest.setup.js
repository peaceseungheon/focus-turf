// jest-expo의 setupFiles가 모든 테스트 환경에 Hermes용 TextDecoder 폴리필을 주입하는데,
// 이 폴리필이 h3-js(WASM)가 사용하는 라벨을 거부해 모듈 로딩이 실패한다.
// 테스트 런타임은 Node이므로 Node 내장 구현으로 되돌린다.
const { TextDecoder: NodeTextDecoder } = require('util');

global.TextDecoder = NodeTextDecoder;

// unistyles: 모의를 먼저 띄운 뒤 등록 설정을 불러 테스트에 테마를 제공한다
require('react-native-unistyles/mocks');
require('./unistyles');
