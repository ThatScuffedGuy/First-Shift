import type { Stage } from '../dialogue/conversation';
import { PLACE_HINTS } from '../data/hints';
import type { Shift } from './shift';
import type { Place } from './zones';

export type Act =
  | { type: 'talk'; guestId: number; stage: Stage }
  | { type: 'seat'; guestId: number; table: number }
  | { type: 'bar' }
  | { type: 'pickup'; guestId: number }
  | { type: 'serve' }
  | { type: 'ticket'; guestId: number }
  | { type: 'reassure'; guestId: number };

/** What the context button shows. Without `act` it's information only. */
export interface ActionChoice {
  label: string;
  hint?: string;
  act?: Act;
}

/** Decides the one thing the player can do where they're standing. */
export function chooseAction(shift: Shift, place: Place): ActionChoice | null {
  if (!place) return null;
  const carry = shift.carrying;
  const carriedFor = carry ? shift.guest(carry.guestId) : undefined;
  const following = shift.following;

  if (place.kind === 'table') {
    const n = place.table.number;
    const g = shift.guestAtTable(n);
    if (!g) {
      if (following) return { label: `Seat ${following.size > 1 ? 'the group' : 'the guest'} at Table ${n}`, act: { type: 'seat', guestId: following.id, table: n } };
      return PLACE_HINTS.table(n);
    }
    if (carry && carriedFor === g) {
      return { label: carry.kind === 'drink' ? `Serve Table ${n}'s drink${g.size > 1 ? 's' : ''}` : `Serve Table ${n}'s food`, act: { type: 'serve' } };
    }
    if (carry) return { label: `Table ${n}`, hint: `You're carrying Table ${carriedFor?.table}'s ${carry.kind}` };
    switch (g.state) {
      case 'seated':
        return { label: `Greet Table ${n}`, act: { type: 'talk', guestId: g.id, stage: 'greet' } };
      case 'ordering':
        return { label: `Take Table ${n}'s order`, act: { type: 'talk', guestId: g.id, stage: 'order' } };
      case 'ticket':
        return { label: `Write Table ${n}'s ticket`, act: { type: 'ticket', guestId: g.id } };
      case 'check':
        return { label: `Bring Table ${n} the check`, act: { type: 'talk', guestId: g.id, stage: 'check' } };
      case 'eating':
        return g.checkedIn
          ? { label: `Table ${n}`, hint: 'Enjoying their meal' }
          : { label: `Check on Table ${n}`, hint: 'Optional: a quick chat for a small mood bonus', act: { type: 'talk', guestId: g.id, stage: 'checkin' } };
      case 'drinks':
      case 'cooking':
      case 'ready':
        if (!g.reassured) return { label: `Tell Table ${n} it's on the way`, hint: 'Buys a little time, once per wait', act: { type: 'reassure', guestId: g.id } };
        return { label: `Table ${n}`, hint: g.state === 'drinks' ? 'Waiting for their drink' : 'Waiting for their food' };
      default:
        return { label: `Table ${n}` };
    }
  }

  const st = place.station;
  if (st.kind === 'door') {
    const next = shift.doorQueue[0];
    if (!next) return PLACE_HINTS.station.door;
    if (following) return { label: 'Door', hint: 'Seat your current guest first' };
    if (carry) return { label: 'Door', hint: "Drop off what you're carrying first" };
    return { label: next.size > 1 ? 'Greet the group at the door' : 'Greet the guest at the door', act: { type: 'talk', guestId: next.id, stage: 'door' } };
  }
  if (st.kind === 'bar') {
    if (carry) return { label: 'Drink station', hint: "Your hands are full" };
    if (shift.guests.some((g) => g.state === 'drinks')) return { label: 'Pour a drink', act: { type: 'bar' } };
    return { label: 'Drink station', hint: 'Nobody is waiting for a drink' };
  }
  // Kitchen pass
  if (carry) return { label: 'Kitchen pass', hint: 'Your hands are full' };
  const ready = shift.guests.filter((g) => g.state === 'ready').sort((a, b) => a.readyAt - b.readyAt)[0];
  if (ready) return { label: `Pick up Table ${ready.table}'s food`, act: { type: 'pickup', guestId: ready.id } };
  if (shift.guests.some((g) => g.state === 'cooking')) return { label: 'Kitchen pass', hint: 'The kitchen is still cooking' };
  return PLACE_HINTS.station.pass;
}
