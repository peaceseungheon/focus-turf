// @mj-studio/react-native-naver-map의 Expo 플러그인은 Manifest/권한만 구성하고
// 네이버 지도 SDK Maven 저장소(repository.map.naver.com)는 선언하지 않는다.
// com.naver.maps:map-sdk가 해당 저장소에만 존재하므로 루트 build.gradle에 추가한다.
// allprojects 블록 중복 선언은 Gradle이 허용한다(@rnmapbox/maps 플러그인도 같은 방식을 쓴다).
const { withProjectBuildGradle } = require('expo/config-plugins');

const NAVER_MAP_MAVEN_URL = 'https://repository.map.naver.com/archive/maven';

const withNaverMapMavenRepo = (config) =>
  withProjectBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes('repository.map.naver.com')) {
      return cfg;
    }
    cfg.modResults.contents += [
      '',
      '// 네이버 지도 SDK 전용 Maven 저장소 (plugins/naver-map-maven-plugin.js)',
      'allprojects {',
      '  repositories {',
      `    maven { url '${NAVER_MAP_MAVEN_URL}' }`,
      '  }',
      '}',
      '',
    ].join('\n');
    return cfg;
  });

module.exports = withNaverMapMavenRepo;
