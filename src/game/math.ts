import type { Point, Rect } from '../data/types';

export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));

export const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.z - b.z);

export const inRect = (p: Point, r: Rect): boolean =>
  p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ;

/** Turn an angle difference into the shortest way round, between -PI and PI. */
export const wrapAngle = (a: number): number => Math.atan2(Math.sin(a), Math.cos(a));
