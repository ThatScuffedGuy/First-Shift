import type { RestaurantLayout } from './types';

/**
 * The house restaurant floor plan, matching the prototype.
 * Move a table here and both the 3D scene and the game rules follow.
 */
export const HOUSE_LAYOUT: RestaurantLayout = {
  floor: { width: 20, depth: 14 },
  backWallHeight: 3.6,
  sideWallHeight: 1.0,
  walkBounds: { minX: -9.3, maxX: 9.3, minZ: -5.5, maxZ: 6.4 },
  waiterStart: { x: -6, z: 4.5 },

  tables: [
    { number: 1, x: -4.4, z: -2.3 },
    { number: 2, x: 4.4, z: -2.3 },
    { number: 3, x: -3.6, z: 3.4 },
    { number: 4, x: 4.4, z: 3.4 },
  ],
  tableRadius: 1.05,
  tableClearance: 1.55,
  chairOffset: 1.35,
  tableReach: 2.6,
  tableTapRadius: 1.7,

  stations: [
    {
      kind: 'door',
      label: 'Door',
      center: { x: -9.2, z: 4.7 },
      zone: { minX: -10, maxX: -6.4, minZ: 2.2, maxZ: 7 },
      labelAt: { x: -8.6, y: 3.0, z: 4.7 },
    },
    {
      kind: 'pass',
      label: 'Kitchen pass',
      center: { x: -4.5, z: -6.45 },
      zone: { minX: -7.5, maxX: -1.5, minZ: -7, maxZ: -4.4 },
      labelAt: { x: -4.5, y: 3.35, z: -6.4 },
    },
    {
      kind: 'bar',
      label: 'Drink station',
      center: { x: 4.5, z: -6.45 },
      zone: { minX: 1.5, maxX: 7.5, minZ: -7, maxZ: -4.4 },
      labelAt: { x: 4.5, y: 3.35, z: -6.4 },
    },
  ],

  doorway: { minZ: 2.5, maxZ: 6.9, height: 2.6 },
  podium: { x: -7.6, z: 6.2, clearance: 0.6 },
  guestEntry: { x: -9.6, z: 5.4 },
  doorQueue: [
    { x: -8.9, z: 5.4 },
    { x: -8.9, z: 4.3 },
    { x: -8.9, z: 3.2 },
  ],
  plants: [
    { x: 9.1, z: 6.2, clearance: 0.85 },
    { x: 9.1, z: -6.2, clearance: 0.85 },
    { x: -9.1, z: -6.2, clearance: 0.85 },
  ],
  signText: 'First Shift',
};
