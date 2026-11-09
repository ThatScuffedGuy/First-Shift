import { TUTORIAL } from '../data/tutorial';
import type { Shift } from './shift';

export type TutorialTarget = { kind: 'door' } | { kind: 'bar' } | { kind: 'pass' } | { kind: 'table'; table: number } | null;

export interface TutorialHint {
  text: string;
  target: TutorialTarget;
}

/**
 * The hint for the tutorial guest's current step. Returns null once that
 * guest has left (the tutorial is over). `guestId` null = waiting for them.
 */
export function tutorialHint(shift: Shift, guestId: number | null): TutorialHint | null {
  if (guestId === null) return { text: TUTORIAL.waiting, target: { kind: 'door' } };
  const g = shift.guest(guestId);
  if (!g) return null;
  const n = g.table ?? 0;
  const t = (s: string) => s.replace('{n}', String(n));
  const table: TutorialTarget = { kind: 'table', table: n };
  const carrying = shift.carrying?.guestId === g.id ? shift.carrying : null;
  switch (g.state) {
    case 'door':
      return { text: TUTORIAL.door, target: { kind: 'door' } };
    case 'following': {
      const free = shift.freeTables[0];
      return { text: TUTORIAL.following, target: free ? { kind: 'table', table: free } : null };
    }
    case 'seated':
      return { text: t(TUTORIAL.seated), target: table };
    case 'drinks':
      return carrying ? { text: t(TUTORIAL.carryingDrink), target: table } : { text: TUTORIAL.drinks, target: { kind: 'bar' } };
    case 'ordering':
      return { text: t(TUTORIAL.ordering), target: table };
    case 'ticket':
      return { text: TUTORIAL.ticket, target: table };
    case 'cooking':
      return { text: t(TUTORIAL.cooking), target: g.reassured ? { kind: 'pass' } : table };
    case 'ready':
      return { text: TUTORIAL.ready, target: { kind: 'pass' } };
    case 'carrying':
      return { text: t(TUTORIAL.carryingFood), target: table };
    case 'eating':
      return g.checkedIn ? { text: TUTORIAL.eatingDone, target: null } : { text: t(TUTORIAL.eating), target: table };
    case 'check':
      return { text: t(TUTORIAL.check), target: table };
  }
}
