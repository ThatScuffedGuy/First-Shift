import { describe, expect, it } from 'vitest';
import { HOUSE_LAYOUT as L } from '../src/data/layout';
import { MOVEMENT } from '../src/data/timing';
import { createWaiter, obstaclesOf, stepWaiter, tapDestination } from '../src/game/waiter';
import { placeAt } from '../src/game/zones';
import { distance } from '../src/game/math';

const obstacles = obstaclesOf(L);
const still = { x: 0, z: 0 };

/** Runs the waiter at 60 frames per second for up to `seconds`. */
function run(w: ReturnType<typeof createWaiter>, input: { x: number; z: number }, seconds: number) {
  for (let i = 0; i < seconds * 60; i++) stepWaiter(w, input, 1 / 60, L, obstacles);
}

describe('waiter movement', () => {
  it('walks at walking speed', () => {
    const w = createWaiter(L);
    w.x = 0; w.z = 0;
    run(w, { x: 1, z: 0 }, 1);
    expect(w.x).toBeCloseTo(MOVEMENT.walkSpeed, 1);
  });

  it('is slower while carrying', () => {
    const w = createWaiter(L);
    w.x = 0; w.z = 0; w.carrying = true;
    run(w, { x: 1, z: 0 }, 1);
    expect(w.x).toBeCloseTo(MOVEMENT.carrySpeed, 1);
  });

  it('cannot walk through a table', () => {
    const t = L.tables[0];
    const w = createWaiter(L);
    w.x = t.x; w.z = t.z + 3;
    run(w, { x: 0, z: -1 }, 3);
    for (const o of obstacles) expect(distance(w, o)).toBeGreaterThanOrEqual(o.radius - 1e-6);
  });

  it('cannot leave the room', () => {
    const w = createWaiter(L);
    run(w, { x: -1, z: 1 }, 5);
    expect(w.x).toBeGreaterThanOrEqual(L.walkBounds.minX);
    expect(w.z).toBeLessThanOrEqual(L.walkBounds.maxZ);
  });

  it('tap-to-walk goes around a table that is in the way', () => {
    const t = L.tables[2];
    const w = createWaiter(L);
    w.x = t.x; w.z = t.z + 2.2;
    w.target = { x: t.x, z: t.z - 2.6 }; // straight through the table
    run(w, still, 6);
    expect(w.target).toBeNull();
    expect(distance(w, { x: t.x, z: t.z - 2.6 })).toBeLessThan(0.2);
  });

  it('tapping a table walks to its edge, within reach', () => {
    const t = L.tables[1];
    const dest = tapDestination({ x: t.x + 0.2, z: t.z }, { x: 0, z: 0 }, L);
    const w = createWaiter(L);
    w.x = 0; w.z = 0; w.target = dest;
    run(w, still, 5);
    const place = placeAt(w, L);
    expect(place?.kind).toBe('table');
    expect(place && place.kind === 'table' && place.table.number).toBe(t.number);
  });
});

describe('places', () => {
  it('knows when the waiter is at each station', () => {
    for (const s of L.stations) {
      const p = { x: (s.zone.minX + s.zone.maxX) / 2, z: Math.min(L.walkBounds.maxZ, Math.max(L.walkBounds.minZ, (s.zone.minZ + s.zone.maxZ) / 2)) };
      const place = placeAt(p, L);
      expect(place?.kind).toBe('station');
      expect(place && place.kind === 'station' && place.station.kind).toBe(s.kind);
    }
  });
});
