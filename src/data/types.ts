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

// ---------------------------------------------------------------- Menus

export const ALLERGENS = ['gluten', 'dairy', 'eggs', 'tree nuts', 'peanuts', 'shellfish', 'fish', 'soy', 'sesame'] as const;
export type Allergen = (typeof ALLERGENS)[number];

export type Category = 'starter' | 'main' | 'dessert' | 'drink';

/** How one item is named in one language. */
export interface ItemName {
  /**
   * The form used inside sentences when ordering or recommending.
   * Spanish: with the article ("el salmón a la parrilla", "una limonada").
   * Russian: accusative case ("лосося на гриле"). English: "the grilled salmon", "a lemonade".
   */
  order: string;
  /** Plain dictionary form, no article (Russian nominative). Used in lists and on the menu. */
  plain: string;
}

export interface MenuItem {
  id: string;
  category: Category;
  price: number;
  allergens: Allergen[];
  /** Short English description of the main ingredients. */
  description: string;
  /** Names per language code, plus "en". */
  names: Record<string, ItemName>;
  /** Colour of the food or drink in 3D (hex string like "#f3e27a"). */
  color: string;
}

export interface Menu {
  id: string;
  name: string;
  items: MenuItem[];
}

// ---------------------------------------------------------------- Guests

export type PersonaKind = 'warm' | 'rushed' | 'rude' | 'indecisive' | 'tourist';

export interface Persona {
  kind: PersonaKind;
  /** Shown in the guest list, e.g. "In a hurry". */
  label: string;
  /** How often this persona turns up, relative to the others. */
  weight: number;
  /** Multiplies every patience limit except the food wait. Below 1 = less patient. */
  patience: number;
  /** Chance (0 to 1) they ask for a recommendation instead of ordering directly. */
  asksRecommendation: number;
}
