import type { Point, RestaurantLayout } from '../data/types';
import { MOVEMENT } from '../data/timing';
import { clamp, distance, wrapAngle } from './math';

/** The waiter's position and movement, with no 3D code, so it can be tested on its own. */
export interface WaiterState {
  x: number;
  z: number;
  /** Facing angle in radians; 0 faces the front of the room (+z). */
  heading: number;
  /** Tap-to-walk destination, if any. */
  target: Point | null;
  /** Whether the waiter moved this frame (drives the walking bob). */
  moving: boolean;
  carrying: boolean;
}

export interface Obstacle extends Point {
  /** How close the waiter's centre may get to the obstacle's centre. */
  radius: number;
}

export function createWaiter(layout: RestaurantLayout): WaiterState {
  return { x: layout.waiterStart.x, z: layout.waiterStart.z, heading: 0, target: null, moving: false, carrying: false };
}

/** Round things the waiter can't walk through: tables, the host stand and plants. */
export function obstaclesOf(L: RestaurantLayout): Obstacle[] {
  return [
    ...L.tables.map((t) => ({ x: t.x, z: t.z, radius: L.tableClearance })),
    { x: L.podium.x, z: L.podium.z, radius: L.podium.clearance },
    ...L.plants.map((p) => ({ x: p.x, z: p.z, radius: p.clearance })),
  ];
}

/**
 * Advances the waiter by dt real seconds.
 * `input` is the keyboard direction (x right, z towards the front); keys cancel tap-to-walk.
 */
export function stepWaiter(w: WaiterState, input: Point, dt: number, L: RestaurantLayout, obstacles: Obstacle[]): void {
  let dir: Point = { x: input.x, z: input.z };
  if (dir.x !== 0 || dir.z !== 0) {
    w.target = null;
  } else if (w.target) {
    if (distance(w, w.target) < MOVEMENT.arriveDistance) {
      w.target = null;
    } else {
      dir = steerAround(w, w.target, obstacles);
    }
  }

  const len = Math.hypot(dir.x, dir.z);
  w.moving = len > 0;
  if (!w.moving) return;

  const speed = w.carrying ? MOVEMENT.carrySpeed : MOVEMENT.walkSpeed;
  let step = speed * dt;
  if (w.target) step = Math.min(step, distance(w, w.target)); // don't overshoot a tap
  w.x += (dir.x / len) * step;
  w.z += (dir.z / len) * step;

  const want = Math.atan2(dir.x, dir.z);
  w.heading += wrapAngle(want - w.heading) * Math.min(1, dt * MOVEMENT.turnRate);

  resolveCollisions(w, L, obstacles);
}

/** Pushes the waiter out of any obstacle and back inside the walls. Sliding along edges falls out of this. */
export function resolveCollisions(p: Point, L: RestaurantLayout, obstacles: Obstacle[]): void {
  for (const o of obstacles) {
    const dx = p.x - o.x, dz = p.z - o.z;
    const d = Math.hypot(dx, dz);
    if (d < o.radius) {
      if (d < 1e-6) {
        p.z = o.z + o.radius; // exactly at the centre: push towards the front
      } else {
        p.x = o.x + (dx / d) * o.radius;
        p.z = o.z + (dz / d) * o.radius;
      }
    }
  }
  p.x = clamp(p.x, L.walkBounds.minX, L.walkBounds.maxX);
  p.z = clamp(p.z, L.walkBounds.minZ, L.walkBounds.maxZ);
}

/**
 * Direction to walk towards `to`. If a table is in the way, aims past its edge
 * instead (along the tangent closest to the straight line), so tap-to-walk
 * goes around tables rather than getting stuck against them.
 */
export function steerAround(from: Point, to: Point, obstacles: Obstacle[]): Point {
  const straight = { x: to.x - from.x, z: to.z - from.z };
  const len = Math.hypot(straight.x, straight.z);
  if (len < 1e-6) return { x: 0, z: 0 };
  const ux = straight.x / len, uz = straight.z / len;

  let blocker: Obstacle | null = null;
  let nearest = Infinity;
  for (const o of obstacles) {
    const r = o.radius + 0.05;
    // Closest approach of the straight path to the obstacle centre.
    const along = (o.x - from.x) * ux + (o.z - from.z) * uz;
    if (along <= 0 || along >= len + r) continue;
    const perp = Math.abs((o.x - from.x) * uz - (o.z - from.z) * ux);
    if (perp >= r) continue;
    // Ignore an obstacle the target sits beside (e.g. walking up to a table).
    if (distance(to, o) < r && along > len) continue;
    if (along < nearest) {
      nearest = along;
      blocker = o;
    }
  }
  if (!blocker) return { x: ux, z: uz };

  const r = blocker.radius + 0.1;
  const cx = blocker.x - from.x, cz = blocker.z - from.z;
  const d = Math.hypot(cx, cz);
  const base = Math.atan2(cx, cz);
  // Angle between the line to the centre and the tangent line; when touching, go sideways.
  const spread = d <= r ? Math.PI / 2 : Math.asin(r / d);
  const want = Math.atan2(ux, uz);
  const a = base + spread, b = base - spread;
  const pick = Math.abs(wrapAngle(a - want)) <= Math.abs(wrapAngle(b - want)) ? a : b;
  return { x: Math.sin(pick), z: Math.cos(pick) };
}

/**
 * Where to walk when the player taps the floor. Tapping on or near a table
 * walks to the near edge of that table, so you end up within reach of it.
 */
export function tapDestination(tap: Point, from: Point, L: RestaurantLayout): Point {
  for (const t of L.tables) {
    if (distance(tap, t) < L.tableTapRadius) {
      const ang = Math.atan2(from.z - t.z, from.x - t.x);
      const edge = L.tableClearance + 0.2;
      return clampToBounds({ x: t.x + Math.cos(ang) * edge, z: t.z + Math.sin(ang) * edge }, L);
    }
  }
  return clampToBounds(tap, L);
}

const clampToBounds = (p: Point, L: RestaurantLayout): Point => ({
  x: clamp(p.x, L.walkBounds.minX, L.walkBounds.maxX),
  z: clamp(p.z, L.walkBounds.minZ, L.walkBounds.maxZ),
});
