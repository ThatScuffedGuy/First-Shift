import type { Allergen, Menu, MenuItem, Persona } from '../data/types';
import { TIMING } from '../data/timing';
import type { OrderFacts } from '../dialogue/context';
import type { Conversation, OrderPlan, Stage } from '../dialogue/conversation';
import { type Rng, pick } from './random';

/** Where a guest is in their visit, in order. */
export type GuestState =
  | 'door' // waiting at the door
  | 'following' // following you to a table
  | 'seated' // waiting to be greeted at the table
  | 'drinks' // waiting for their drink
  | 'ordering' // has their drink, ready to order food
  | 'ticket' // ordered; you still need to write the ticket
  | 'cooking' // ticket sent, kitchen is cooking
  | 'ready' // plate is waiting at the kitchen pass
  | 'carrying' // you're carrying their plate
  | 'eating'
  | 'check'; // wants the check

/** Patience is tracked per wait. States in the same wait share one timer. */
export type Phase = keyof typeof TIMING.patience;

export const PHASE_OF: Record<GuestState, Phase | null> = {
  door: 'door',
  following: null,
  seated: 'seated',
  drinks: 'drinks',
  ordering: 'ordering',
  ticket: 'ordering',
  cooking: 'food',
  ready: 'food',
  carrying: 'food',
  eating: null,
  check: 'check',
};

/** One entry in the conversation log shown in the talk panel. */
export type LogEntry =
  | { who: 'guest' | 'you'; text: string; en: string; clipId?: string; revealed?: boolean }
  | { who: 'coach'; ok: boolean; note: string };

export interface Guest {
  id: number;
  persona: Persona;
  /** Seed for their looks and voice. */
  look: number;
  order: OrderFacts;
  plan: OrderPlan | null;
  mood: number;
  state: GuestState;
  /** Table number, once seated. */
  table: number | null;

  // Patience for the current wait
  phase: Phase | null;
  waited: number;
  drops: number;
  prevDropAt: number;
  nextDropAt: number;
  reassured: boolean;

  readyAt: number;
  doneAt: number;
  ticket: { dishIds: string[]; flags: Allergen[] } | null;
  hasDrink: boolean;
  checkedIn: boolean;
  talk: Conversation | null;
  talkStage: Stage | null;
  log: LogEntry[];
}

export const foods = (menu: Menu) => menu.items.filter((m) => m.category !== 'drink');
export const drinks = (menu: Menu) => menu.items.filter((m) => m.category === 'drink');
export const mains = (menu: Menu) => menu.items.filter((m) => m.category === 'main');
export const starters = (menu: Menu) => menu.items.filter((m) => m.category === 'starter');

/** Rolls up a new guest: what they'll drink and eat, and maybe an allergy. */
export function createGuest(id: number, persona: Persona, menu: Menu, rng: Rng): Guest {
  const drinkList = drinks(menu);
  const drink = pick(rng, drinkList);
  const other = pick(rng, drinkList.filter((d) => d !== drink));
  const dishIds = [pick(rng, mains(menu)).id];
  if (rng() < TIMING.starterChance && starters(menu).length) dishIds.unshift(pick(rng, starters(menu)).id);
  const present = [...new Set(foods(menu).flatMap((m) => m.allergens))];
  const allergy = present.length && rng() < TIMING.allergyChance ? pick(rng, present) : null;
  return {
    id,
    persona,
    look: Math.floor(rng() * 1e9),
    order: { drinkId: drink.id, otherDrinkId: other.id, dishIds, allergy },
    plan: null,
    mood: TIMING.startMood,
    state: 'door',
    table: null,
    phase: 'door',
    waited: 0,
    drops: 0,
    prevDropAt: 0,
    nextDropAt: patienceLimit('door', persona),
    reassured: false,
    readyAt: 0,
    doneAt: 0,
    ticket: null,
    hasDrink: false,
    checkedIn: false,
    talk: null,
    talkStage: null,
    log: [],
  };
}

/** Time until the first mood drop in a wait. Personas change it, except for the food wait. */
export function patienceLimit(phase: Phase, persona: Persona): number {
  return TIMING.patience[phase] * (phase === 'food' ? 1 : persona.patience);
}

/**
 * Decides how the food order goes: whether they ask for a recommendation, and
 * whether a dish they want clashes with their allergy (with a safe swap).
 * Updates guest.order with the recommendation, conflict and safe dish.
 */
export function planOrder(g: Guest, menu: Menu, rng: Rng): OrderPlan {
  const recommend = rng() < g.persona.asksRecommendation;
  if (recommend) {
    const rec = pick(rng, mains(menu));
    g.order.recId = rec.id;
    g.order.dishIds = g.order.dishIds.filter((id) => byId(menu, id).category === 'starter').concat(rec.id);
  }
  let conflict = false;
  const a = g.order.allergy;
  if (a) {
    const clash = g.order.dishIds.map((id) => byId(menu, id)).find((d) => d.allergens.includes(a));
    if (clash) {
      const safeFrom = (list: MenuItem[]) => list.filter((m) => !m.allergens.includes(a) && !g.order.dishIds.includes(m.id));
      const sameKind = safeFrom(menu.items.filter((m) => m.category === clash.category));
      const safe = sameKind.length ? sameKind : safeFrom(mains(menu));
      if (safe.length) {
        g.order.conflictId = clash.id;
        g.order.safeId = pick(rng, safe).id;
        conflict = true;
      }
    }
  }
  g.plan = { recommend, allergy: !!a, conflict };
  return g.plan;
}

export const byId = (menu: Menu, id: string): MenuItem => {
  const m = menu.items.find((x) => x.id === id);
  if (!m) throw new Error(`No menu item "${id}"`);
  return m;
};
