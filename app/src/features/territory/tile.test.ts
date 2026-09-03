/**
 * 순수 도메인 로직 테스트 — React Native 폴리필 없이 node 환경에서 실행한다.
 * (jest-expo 환경의 TextDecoder 폴리필이 h3-js 로딩과 충돌함)
 *
 * @jest-environment node
 */
import { getResolution } from 'h3-js';
import { boundaryOf, cellAt, cellsAround, cellsAroundCell, centerOf, TILE_RESOLUTION } from './tile';

const GANGNAM_STATION = { lat: 37.4979, lng: 127.0276 };

describe('tile', () => {
  test('cellAt은 타일 해상도의 셀을 반환한다', () => {
    expect(getResolution(cellAt(GANGNAM_STATION))).toBe(TILE_RESOLUTION);
  });

  test('셀 중심 좌표는 자기 셀로 왕복 판정된다', () => {
    // 경계 근처 좌표는 인접 셀로 넘어갈 수 있어 근접성은 보장하지 않는다(§6-④ 히스테리시스 대상)
    const cell = cellAt(GANGNAM_STATION);
    expect(cellAt(centerOf(cell))).toBe(cell);
  });

  test('cellsAround은 육각 링 개수를 반환한다', () => {
    expect(cellsAround(GANGNAM_STATION, 0)).toHaveLength(1);
    expect(cellsAround(GANGNAM_STATION, 1)).toHaveLength(7);
    expect(cellsAround(GANGNAM_STATION, 2)).toHaveLength(19);
  });

  test('cellsAroundCell은 좌표 기반 호출과 동일한 결과를 반환한다', () => {
    const cell = cellAt(GANGNAM_STATION);
    expect(cellsAroundCell(cell, 0)).toHaveLength(1);
    expect(cellsAroundCell(cell, 1)).toHaveLength(7);
    expect(cellsAroundCell(cell, 2)).toHaveLength(19);
    expect(cellsAroundCell(cell, 1)).toEqual(cellsAround(GANGNAM_STATION, 1));
  });

  test('경계는 중심 근처의 6개 꼭짓점으로 구성된다', () => {
    const cell = cellAt(GANGNAM_STATION);
    const boundary = boundaryOf(cell);
    expect(boundary).toHaveLength(6);

    const center = centerOf(cell);
    for (const vertex of boundary) {
      // 25m급 격자의 꼭짓점은 중심에서 위도·경도 약 0.0005도(약 50m) 이내에 있다
      expect(Math.abs(vertex.lat - center.lat)).toBeLessThan(0.0005);
      expect(Math.abs(vertex.lng - center.lng)).toBeLessThan(0.0005);
    }
  });
});
