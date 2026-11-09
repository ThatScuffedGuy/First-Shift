import type { Point, RestaurantLayout, Station, TableSpot } from '../data/types';
import { distance, inRect } from './math';

export type Place =
  | { kind: 'table'; table: TableSpot }
  | { kind: 'station'; station: Station }
  | null;

/** What the waiter is standing next to: the nearest table in reach, or a station. */
export function placeAt(p: Point, L: RestaurantLayout): Place {
  let best: TableSpot | null = null;
  let bestD = L.tableReach;
  for (const t of L.tables) {
    const d = distance(p, t);
    if (d < bestD) {
      bestD = d;
      best = t;
    }
  }
  if (best) return { kind: 'table', table: best };
  const station = L.stations.find((s) => inRect(p, s.zone));
  return station ? { kind: 'station', station } : null;
}
