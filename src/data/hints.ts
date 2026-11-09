import type { StationKind } from './types';
import type { GuestState } from '../game/guest';

/**
 * Interface text: what the action button says when there's nothing to do,
 * and how each guest state is described in the guest list.
 * Kept here so it can be reworded or translated without touching code.
 */
export const PLACE_HINTS = {
  table: (n: number) => ({ label: `Table ${n}`, hint: 'Free table' }),
  station: {
    door: { label: 'Door', hint: 'Guests arrive and wait here' },
    pass: { label: 'Kitchen pass', hint: 'Finished plates come out here' },
    bar: { label: 'Drink station', hint: 'Pour drinks here' },
  } satisfies Record<StationKind, { label: string; hint: string }>,
};

export const STATUS: Record<GuestState, { text: string; icon: string }> = {
  door: { text: 'Waiting at the door', icon: '👋' },
  following: { text: 'Following you to a table', icon: '🚶' },
  seated: { text: 'Waiting to be greeted', icon: '🖐️' },
  drinks: { text: 'Waiting for their drink', icon: '🥤' },
  ordering: { text: 'Ready to order', icon: '📝' },
  ticket: { text: 'Ticket not sent yet', icon: '📝' },
  cooking: { text: 'Food is cooking', icon: '⏳' },
  ready: { text: 'Food is ready at the pass', icon: '🔔' },
  carrying: { text: 'Food is on the way', icon: '⏳' },
  eating: { text: 'Eating', icon: '🍽️' },
  check: { text: 'Wants the check', icon: '🧾' },
};

/** Mood 0..5 as a face and a word. */
export const MOODS = [
  { face: '😠', word: 'furious' },
  { face: '😠', word: 'annoyed' },
  { face: '😕', word: 'unsure' },
  { face: '😐', word: 'okay' },
  { face: '🙂', word: 'happy' },
  { face: '😀', word: 'delighted' },
];
