/**
 * Every timing and scoring number in the game. Times are in GAME seconds
 * (the game clock runs `gameRate` times faster than real life), unless the
 * name says "real".
 */
export const TIMING = {
  /** Game seconds that pass per real second. 5 means one game minute is 12 real seconds. */
  gameRate: 5,
  /** The shift starts at this hour on a 24-hour clock (18 = 6:00 PM). */
  shiftStartHour: 18,

  // Arrivals
  guestsPerShift: 5,
  /** When the first guest walks in. */
  firstArrival: 20,
  /** Gap between arrivals: somewhere between 4 and 7.5 game minutes. */
  arrivalGap: [240, 450] as [number, number],
  /** If the door queue is full, try again this much later. */
  queueFullRetry: 30,

  // Patience: how long before the FIRST mood drop in each wait.
  patience: {
    door: 240, // waiting at the door to be greeted
    seated: 180, // seated, waiting for you to come and greet them
    drinks: 300, // waiting for their drink
    ordering: 240, // waiting to order, until the ticket is sent
    food: 900, // from sending the ticket until the food arrives
    check: 300, // waiting for the check
  },
  /** After the first drop, another drop every 2 to 3 game minutes. */
  repeatDrop: [120, 180] as [number, number],
  /** Telling a table "it's on the way" (once per wait) takes this much off their wait. */
  reassureBonus: 90,

  // Kitchen and eating
  cookTime: [360, 540] as [number, number],
  remakeTime: 240,
  eatTime: [900, 1500] as [number, number],

  /** Each line of dialogue takes this long on the game clock. */
  lineSeconds: 15,

  // Mood runs 0 to 5. 0 means they walk out.
  startMood: 3,
  maxMood: 5,
  /** Tip as a percent of the bill, by final mood 0..5. */
  tipPercentByMood: [0, 5, 10, 15, 18, 22],
  wrongLinePenalty: 1,
  wrongDrinkPenalty: 1,
  wrongDishPenalty: 2,
  spillPenalty: 1,
  checkinBonus: 1,
  allergyFlaggedBonus: 1,

  // What guests order
  allergyChance: 0.4,
  starterChance: 0.35,

  // Accidents while carrying
  accident: {
    /** Chance of an accident on each trip. */
    chance: 0.35,
    /** It can happen once you've walked this far (metres) with the item. */
    afterWalking: 2.2,
    /** Real seconds you have to react. */
    reactSeconds: 1.7,
  },
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
  /** Guests' walking speed in metres per real second. */
  guestSpeed: 3.4,
};
