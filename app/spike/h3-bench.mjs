// H3 격자 기술 검증 Spike (PRD §12 육각 격자, §18-2/Q3 H3 바인딩 검증)
// 실행: node spike/h3-bench.mjs
// 순수 Node 환경에서 동작하며 기기·지도 SDK와 무관하다.
import {
  cellToBoundary,
  cellToLatLng,
  getHexagonEdgeLengthAvg,
  gridDisk,
  latLngToCell,
  polygonToCells,
} from 'h3-js';

const GANGNAM_STATION = { lat: 37.4979, lng: 127.0276 };
const METERS_PER_DEG_LAT = 111_320;

function elapsedMs(operation) {
  const startedAt = performance.now();
  operation();
  return performance.now() - startedAt;
}

function squareAround({ lat, lng }, halfMeters) {
  const dLat = halfMeters / METERS_PER_DEG_LAT;
  const dLng = halfMeters / (METERS_PER_DEG_LAT * Math.cos((lat * Math.PI) / 180));
  // h3-js v4 polygonToCells는 기본 입력으로 [위도, 경도] 순서의 닫힌 링을 받는다
  return [
    [
      [lat - dLat, lng - dLng],
      [lat - dLat, lng + dLng],
      [lat + dLat, lng + dLng],
      [lat + dLat, lng - dLng],
      [lat - dLat, lng - dLng],
    ],
  ];
}

// 1. 해상도 확인 — 25m급 격자에 대응하는 H3 해상도
console.log('== 1. 해상도별 평균 변 길이 (m) ==');
for (const resolution of [9, 10, 11, 12]) {
  console.log(`res ${resolution}: ${getHexagonEdgeLengthAvg(resolution, 'm').toFixed(1)} m`);
}

// 2. 좌표 → 셀 판정 성능 (세션 중 15초 샘플링 1건당 1회 호출)
console.log('\n== 2. latLngToCell 성능 ==');
const samples = 100_000;
const randomCoords = Array.from({ length: samples }, () => ({
  lat: 37.4 + Math.random() * 0.3,
  lng: 126.8 + Math.random() * 0.4,
}));
const ms = elapsedMs(() => {
  for (const { lat, lng } of randomCoords) {
    latLngToCell(lat, lng, 11);
  }
});
console.log(
  `${samples.toLocaleString()}회 호출: ${ms.toFixed(0)} ms (${((ms / samples) * 1000).toFixed(2)} µs/회)`,
);

// 3. 셀 경계(폴리곤 꼭짓점) 생성 성능 — 지도 오버레이 데이터
console.log('\n== 3. cellToBoundary 성능 ==');
const cells = gridDisk(latLngToCell(GANGNAM_STATION.lat, GANGNAM_STATION.lng, 11), 25);
const boundaryMs = elapsedMs(() => {
  for (const cell of cells) {
    cellToBoundary(cell);
  }
});
console.log(
  `${cells.length}개 셀 경계 생성: ${boundaryMs.toFixed(1)} ms (${((boundaryMs / cells.length) * 1000).toFixed(1)} µs/셀, 꼭짓점 ${cellToBoundary(cells[0]).length}개)`,
);

// 4. 뷰포트 크기별 셀 개수 — 오버레이 폴리곤 수 규모 추정
console.log('\n== 4. 뷰포트 면적별 res11 셀 개수 ==');
for (const halfMeters of [125, 250, 500, 1000, 2000]) {
  const polygon = squareAround(GANGNAM_STATION, halfMeters);
  const countMs = elapsedMs(() => {
    polygonToCells(polygon, 11);
  });
  const count = polygonToCells(polygon, 11).length;
  console.log(
    `${(halfMeters * 2 / 1000).toFixed(2)}km 정사각형: ${count}개 셀 (변환 ${countMs.toFixed(1)} ms)`,
  );
}

// 5. 이웃 격자 규모 (감쇠/점령 판정용)
console.log('\n== 5. gridDisk 반지름별 셀 수 ==');
for (const radius of [1, 5, 10, 25, 50]) {
  console.log(`k=${radius}: ${gridDisk(latLngToCell(GANGNAM_STATION.lat, GANGNAM_STATION.lng, 11), radius).length}개`);
}

// 6. 셀 중심 역변환 정확성 (점령 판정 서버 통신 좌표)
const [centerLat, centerLng] = cellToLatLng(latLngToCell(GANGNAM_STATION.lat, GANGNAM_STATION.lng, 11));
console.log(`\n== 6. 셀 중심 역변환 == 강남역 (${GANGNAM_STATION.lat}, ${GANGNAM_STATION.lng}) → 셀 중심 (${centerLat.toFixed(6)}, ${centerLng.toFixed(6)})`);
