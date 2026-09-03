import { cellToBoundary, cellToLatLng, gridDisk, latLngToCell } from 'h3-js';

/** PRD §6-① 25m급 격자 가설에 대응하는 H3 해상도 (평균 변 길이 약 25m). */
export const TILE_RESOLUTION = 11;

export interface LatLng {
  lat: number;
  lng: number;
}

/** 좌표가 속한 타일(H3 셀) 인덱스를 반환한다. */
export function cellAt(position: LatLng, resolution: number = TILE_RESOLUTION): string {
  return latLngToCell(position.lat, position.lng, resolution);
}

/** 중심 타일을 포함해 반지름 k겹의 이웃 타일 인덱스 목록을 반환한다. */
export function cellsAround(
  center: LatLng,
  ringRadius: number,
  resolution: number = TILE_RESOLUTION,
): string[] {
  return gridDisk(cellAt(center, resolution), ringRadius);
}

/** 타일 하나의 육각 경계(위도·경도 꼭짓점)를 반환한다. */
export function boundaryOf(cell: string): LatLng[] {
  return cellToBoundary(cell).map(([lat, lng]) => ({ lat, lng }));
}

/** 타일 중심 좌표를 반환한다. */
export function centerOf(cell: string): LatLng {
  const [lat, lng] = cellToLatLng(cell);
  return { lat, lng };
}
