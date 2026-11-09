import type { StationKind } from './types';

/**
 * What the action button says when you stand somewhere with nothing to do yet.
 * Interface text, kept here so it can be translated or reworded without touching code.
 */
export const PLACE_HINTS = {
  table: (n: number) => ({ label: `Table ${n}`, hint: 'No guest here yet' }),
  station: {
    door: { label: 'Door', hint: 'Guests arrive and wait here' },
    pass: { label: 'Kitchen pass', hint: 'Finished plates come out here' },
    bar: { label: 'Drink station', hint: 'Pour drinks here' },
  } satisfies Record<StationKind, { label: string; hint: string }>,
};
