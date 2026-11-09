import { describe, expect, it } from 'vitest';
import { Shift } from '../src/game/shift';
import type { Guest } from '../src/game/guest';
import { byId } from '../src/game/guest';
import { languageByCode } from '../src/data/languages';
import { HOUSE_MENU } from '../src/data/menus';
import { TIMING } from '../src/data/timing';
import { seeded } from '../src/game/random';
import type { Stage } from '../src/dialogue/conversation';

function newShift(seed = 7, guests = 5) {
  return new Shift({ pack: languageByCode('es'), menu: HOUSE_MENU, tables: [1, 2, 3, 4], rng: seeded(seed), guests });
}

/** Lets the first guest walk in. */
function firstGuest(s: Shift): Guest {
  s.tick(TIMING.firstArrival + 1);
  return s.guests[0];
}

/** Answers a whole conversation correctly. */
function talkThrough(s: Shift, g: Guest, stage: Stage) {
  const talk = s.talk(g, stage);
  while (!talk.done) s.answer(g, talk.turn!.options.findIndex((o) => o.correct));
  s.endTalk(g);
}

/** Runs the clock in small steps until a condition is true. */
function waitFor(s: Shift, cond: () => boolean, max = 4000) {
  for (let t = 0; t < max && !cond(); t += 5) s.tick(5);
}

describe('a guest visit', () => {
  it('goes from the door to paying, and tips when happy', () => {
    const s = newShift(7, 1);
    const events: string[] = [];
    s.on((e) => events.push(e.type));
    const g = firstGuest(s);
    expect(g.state).toBe('door');

    talkThrough(s, g, 'door');
    expect(g.state).toBe('following');
    s.seat(g, 3);
    expect(g.table).toBe(3);

    talkThrough(s, g, 'greet');
    expect(g.state).toBe('drinks');
    s.pour(g, g.order.drinkId);
    expect(s.serve()).toBe(true); // opens the order conversation next
    expect(g.state).toBe('ordering');

    talkThrough(s, g, 'order');
    expect(g.state).toBe('ticket');
    s.sendTicket(g, g.order.dishIds, g.order.allergy ? [g.order.allergy] : []);
    expect(g.state).toBe('cooking');

    waitFor(s, () => g.state === 'ready');
    s.pickUp(g);
    s.serve();
    expect(g.state).toBe('eating');

    talkThrough(s, g, 'checkin');
    expect(g.checkedIn).toBe(true);
    waitFor(s, () => g.state === 'check');
    talkThrough(s, g, 'check');

    expect(s.records).toHaveLength(1);
    expect(s.records[0].outcome).toBe('served');
    expect(s.records[0].tip).toBeGreaterThan(0);
    expect(s.tips).toBe(s.records[0].tip);
    expect(events).toContain('orderUp');
  });

  it('swaps the dish when the guest takes the allergy-safe suggestion', () => {
    // Find a seed whose first guest has a conflicting allergy.
    for (let seed = 1; seed < 400; seed++) {
      const s = newShift(seed);
      const g = firstGuest(s);
      talkThrough(s, g, 'door');
      s.seat(g, 1);
      talkThrough(s, g, 'greet');
      s.pour(g, g.order.drinkId);
      s.serve();
      talkThrough(s, g, 'order');
      if (!g.plan?.conflict) continue;
      const a = g.order.allergy!;
      expect(g.order.dishIds).toContain(g.order.safeId);
      expect(g.order.dishIds).not.toContain(g.order.conflictId);
      for (const id of g.order.dishIds) expect(byId(HOUSE_MENU, id).allergens).not.toContain(a);
      return;
    }
    throw new Error('No conflict found in 400 seeds');
  });
});

describe('mistakes', () => {
  function toDrinks(seed = 7) {
    const s = newShift(seed);
    const g = firstGuest(s);
    talkThrough(s, g, 'door');
    s.seat(g, 2);
    talkThrough(s, g, 'greet');
    return { s, g };
  }

  it('a wrong drink costs mood', () => {
    const { s, g } = toDrinks();
    const before = g.mood;
    s.pour(g, g.order.otherDrinkId);
    s.serve();
    expect(g.mood).toBe(before - TIMING.wrongDrinkPenalty);
    expect(s.stats.wrongDrinks).toBe(1);
  });

  it('a wrong line costs 1 mood and is saved for practice', () => {
    const { s, g } = toDrinks();
    s.pour(g, g.order.drinkId);
    s.serve();
    const talk = s.talk(g, 'order');
    const before = g.mood;
    s.answer(g, talk.turn!.options.findIndex((o) => !o.correct));
    expect(g.mood).toBe(before - 1);
    expect(s.missed).toHaveLength(1);
    expect(s.missed[0].why.length).toBeGreaterThan(0);
  });

  it('an unflagged allergy in the food causes a reaction and no tip', () => {
    const { s, g } = toDrinks();
    s.pour(g, g.order.drinkId);
    s.serve();
    talkThrough(s, g, 'order');
    // Put a dish with an allergen on the ticket and give the guest that allergy.
    g.order.allergy = 'fish';
    s.sendTicket(g, ['grilled-salmon'], []);
    waitFor(s, () => g.state === 'ready');
    s.pickUp(g);
    s.serve();
    expect(s.records[0].outcome).toBe('allergic reaction');
    expect(s.records[0].tip).toBe(0);
  });

  it('a guest left waiting long enough walks out', () => {
    const s = newShift();
    firstGuest(s);
    waitFor(s, () => s.records.length > 0, 5000);
    expect(s.records[0].outcome).toBe('walked out');
  });

  it('patience drops once at the first limit, then every 2 to 3 minutes', () => {
    const s = newShift();
    const g = firstGuest(s);
    const limit = TIMING.patience.door * g.persona.patience;
    s.tick(limit - 2);
    expect(g.mood).toBe(TIMING.startMood);
    s.tick(4);
    expect(g.mood).toBe(TIMING.startMood - 1);
    s.tick(TIMING.repeatDrop[1] * g.persona.patience + 1);
    expect(g.mood).toBe(TIMING.startMood - 2);
  });
});

describe('the shift', () => {
  it('ends after every guest has left', () => {
    const s = newShift(3, 2);
    let over = false;
    s.on((e) => { if (e.type === 'over') over = true; });
    waitFor(s, () => s.over, 20000);
    expect(over).toBe(true);
    expect(s.records).toHaveLength(2);
  });
});
