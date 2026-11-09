import { describe, expect, it } from 'vitest';
import { HOUSE_LAYOUT as L } from '../src/data/layout';
import { distance, inRect } from '../src/game/math';

describe('house layout', () => {
  it('numbers tables 1, 2, 3... with no gaps', () => {
    expect(L.tables.map((t) => t.number)).toEqual(L.tables.map((_, i) => i + 1));
  });
  it('keeps every table reachable inside the walking area', () => {
    for (const t of L.tables) expect(inRect(t, L.walkBounds)).toBe(true);
  });
  it('does not let tables overlap', () => {
    for (const a of L.tables)
      for (const b of L.tables)
        if (a !== b) expect(distance(a, b)).toBeGreaterThan(L.tableClearance * 2);
  });
  it('has exactly one door, kitchen pass and drink station', () => {
    expect(L.stations.map((s) => s.kind).sort()).toEqual(['bar', 'door', 'pass']);
  });
  it('lets the waiter start somewhere walkable', () => {
    expect(inRect(L.waiterStart, L.walkBounds)).toBe(true);
  });
});
