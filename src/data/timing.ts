/**
 * Clock and movement tuning. Guest patience, cooking times and so on join
 * this file in milestone 2.
 */
export const TIMING = {
  /** Game seconds that pass per real second. 5 means one game minute is 12 real seconds. */
  gameRate: 5,
  /** The shift starts at this time, in hours on a 24-hour clock (18 = 6:00 PM). */
  shiftStartHour: 18,
};

export const MOVEMENT = {
  /** Waiter walking speed in metres per real second. */
  walkSpeed: 5.2,
  /** Slower while carrying a plate or a drink. */
  carrySpeed: 4.2,
  /** How quickly the waiter turns to face where they're walking (higher is snappier). */
  turnRate: 12,
  /** Tap-to-walk stops when this close to the target. */
  arriveDistance: 0.12,
};
