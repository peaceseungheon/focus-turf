/**
 * 보호 구역 순수 도메인(PRD §9).
 * 보호 구역 타일은 점령 시스템에서 완전 제외된다 — 집중 기록은 개인 통계에만 남는다.
 * 다른 유저에게는 일반 무주지로 보일 수 있으나 다유저는 서버 도입 시점 과제다.
 */
export type PrivateZones = ReadonlySet<string>;

/** 보호 구역 집합에 타일을 추가한다(불변 갱신). */
export function protectZone(zones: PrivateZones, cellId: string): PrivateZones {
  return new Set(zones).add(cellId);
}

/** 보호 구역 집합에서 타일을 제외한다(불변 갱신). */
export function unprotectZone(zones: PrivateZones, cellId: string): PrivateZones {
  const next = new Set(zones);
  next.delete(cellId);
  return next;
}

/** 해당 타일이 보호 구역인가. */
export function isProtected(zones: PrivateZones, cellId: string): boolean {
  return zones.has(cellId);
}
