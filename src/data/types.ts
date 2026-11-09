/**
 * Shapes of the game's data files. Game code reads these; it never hard-codes
 * positions, timings or text. Coordinates are in metres on the floor plane:
 * x runs left (-) to right (+), z runs from the back wall (-) to the front (+).
 */

export interface Point {
  x: number;
  z: number;
}

/** An axis-aligned rectangle on the floor. */
export interface Rect {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

export interface TableSpot extends Point {
  /** Shown to the player as "Table 1", "Table 2"... */
  number: number;
}

export type StationKind = 'door' | 'pass' | 'bar';

export interface Station {
  kind: StationKind;
  /** Name shown on the floating label and in the action button. */
  label: string;
  /** Centre of the station, used to place props. */
  center: Point;
  /** Standing inside this rectangle counts as being "at" the station. */
  zone: Rect;
  /** Where the floating label hangs. */
  labelAt: Point & { y: number };
}

export interface RestaurantLayout {
  /** Size of the floor, centred on (0, 0). */
  floor: { width: number; depth: number };
  /** Height of the back wall. Side walls are low so the camera can see in. */
  backWallHeight: number;
  sideWallHeight: number;
  /** Where the waiter may walk. */
  walkBounds: Rect;
  waiterStart: Point;
  tables: TableSpot[];
  /** Round table radius and how close the waiter may get to its centre. */
  tableRadius: number;
  tableClearance: number;
  /** How far the guest's chair sits behind (towards the back wall) the table centre. */
  chairOffset: number;
  /** How close the waiter must be to a table to act on it. */
  tableReach: number;
  /** Tapping within this distance of a table walks you to its edge. */
  tableTapRadius: number;
  stations: Station[];
  /** The door opening on the left wall: from z to z. */
  doorway: { minZ: number; maxZ: number; height: number };
  podium: Point & { clearance: number };
  /** Where arriving guests appear, then where they queue (first spot first). */
  guestEntry: Point;
  doorQueue: Point[];
  plants: (Point & { clearance: number })[];
  signText: string;
}
