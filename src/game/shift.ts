import type { Allergen, Menu } from '../data/types';
import { PERSONAS } from '../data/personas';
import { TIMING } from '../data/timing';
import { buildContext } from '../dialogue/context';
import { Conversation, nodesForStage, selectPool, type ChooseResult, type Stage } from '../dialogue/conversation';
import type { LanguagePack } from '../dialogue/types';
import { type Guest, type GuestState, PHASE_OF, byId, createGuest, patienceLimit, planOrder } from './guest';
import { type Rng, between, weighted } from './random';
import { clamp } from './math';

export type Tone = 'info' | 'good' | 'bad';

export type ShiftEvent =
  | { type: 'toast'; text: string; tone: Tone }
  | { type: 'arrived'; guest: Guest }
  | { type: 'orderUp'; guest: Guest }
  | { type: 'served'; guest: Guest; kind: 'drink' | 'food'; ok: boolean }
  | { type: 'left'; guest: Guest; record: VisitRecord }
  | { type: 'spill'; kind: 'drink' | 'food'; drinkId?: string }
  | { type: 'saved' }
  | { type: 'moodDrop'; guest: Guest }
  | { type: 'answer'; guest: Guest; correct: boolean }
  | { type: 'over' };

export type Carry =
  | { kind: 'drink'; guestId: number; drinkId: string; walked: number; rolled: boolean }
  | { kind: 'food'; guestId: number; walked: number; rolled: boolean };

export interface VisitRecord {
  table: number | null;
  persona: string;
  outcome: 'served' | 'walked out' | 'allergic reaction';
  tip: number;
  /** Final mood 0..5, used as the star rating. */
  stars: number;
  bill: number;
}

/** A line the player got wrong, for "phrases to practice". */
export interface MissedLine {
  said: string;
  better: string;
  betterEn: string;
  why: string;
}

export interface ShiftStats {
  turns: number;
  firstTry: number;
  wrongPicks: number;
  wrongDrinks: number;
  wrongDishes: number;
  allergyReactions: number;
  unflaggedAllergies: number;
  spills: number;
  saves: number;
  walkouts: number;
  checkins: number;
}

export interface ShiftOptions {
  pack: LanguagePack;
  menu: Menu;
  /** Table numbers in the restaurant. */
  tables: number[];
  rng?: Rng;
  guests?: number;
}

const where = (g: Guest) => (g.table ? `Table ${g.table}` : 'The guest at the door');

/**
 * One dinner shift: the clock, the guests, and everything the player can do.
 * No 3D or screen code here; the scene and UI read this state and call its methods.
 */
export class Shift {
  readonly pack: LanguagePack;
  readonly menu: Menu;
  readonly total: number;
  readonly tables: number[];
  private rng: Rng;
  private listeners: ((e: ShiftEvent) => void)[] = [];
  private nextId = 1;

  /** Game seconds since 6:00 PM. */
  time = 0;
  guests: Guest[] = [];
  records: VisitRecord[] = [];
  incidents: string[] = [];
  missed: MissedLine[] = [];
  tips = 0;
  spawned = 0;
  carrying: Carry | null = null;
  /** The guest you're talking to; their patience pauses. */
  activeGuestId: number | null = null;
  over = false;
  private nextArrival = TIMING.firstArrival;
  stats: ShiftStats = { turns: 0, firstTry: 0, wrongPicks: 0, wrongDrinks: 0, wrongDishes: 0, allergyReactions: 0, unflaggedAllergies: 0, spills: 0, saves: 0, walkouts: 0, checkins: 0 };

  constructor(opts: ShiftOptions) {
    this.pack = opts.pack;
    this.menu = opts.menu;
    this.tables = opts.tables;
    this.rng = opts.rng ?? Math.random;
    this.total = opts.guests ?? TIMING.guestsPerShift;
  }

  on(fn: (e: ShiftEvent) => void): void {
    this.listeners.push(fn);
  }

  private emit(e: ShiftEvent): void {
    for (const fn of this.listeners) fn(e);
  }

  private toast(text: string, tone: Tone = 'info'): void {
    this.emit({ type: 'toast', text, tone });
  }

  guest(id: number): Guest | undefined {
    return this.guests.find((g) => g.id === id);
  }

  guestAtTable(table: number): Guest | undefined {
    return this.guests.find((g) => g.table === table);
  }

  get freeTables(): number[] {
    return this.tables.filter((t) => !this.guestAtTable(t));
  }

  get doorQueue(): Guest[] {
    return this.guests.filter((g) => g.state === 'door');
  }

  get following(): Guest | undefined {
    return this.guests.find((g) => g.state === 'following');
  }

  // ------------------------------------------------------------- Time

  /** Advances the game clock by dt game seconds. */
  tick(dt: number): void {
    if (this.over) return;
    this.time += dt;
    for (const g of this.guests.slice()) {
      if (g.state === 'cooking' && this.time >= g.readyAt) {
        this.setState(g, 'ready');
        this.toast(`Order up for Table ${g.table}. Grab it from the kitchen pass.`);
        this.emit({ type: 'orderUp', guest: g });
      }
      if (g.state === 'eating' && this.time >= g.doneAt) {
        this.setState(g, 'check');
        this.toast(`Table ${g.table} is done eating and wants the check.`);
        continue; // a new wait starts now; don't count this step against it
      }
      if (g.id === this.activeGuestId || !g.phase) continue;
      g.waited += dt;
      while (g.phase && g.waited >= g.nextDropAt && this.guests.includes(g)) {
        g.drops++;
        g.prevDropAt = g.nextDropAt;
        g.nextDropAt += between(this.rng, TIMING.repeatDrop) * (g.phase === 'food' ? 1 : g.persona.patience);
        this.changeMood(g, -1);
        this.emit({ type: 'moodDrop', guest: g });
      }
    }
    // Arrivals last, so a new guest's wait starts from zero.
    if (this.spawned < this.total && this.time >= this.nextArrival) {
      if (this.doorQueue.length < 3) {
        this.arrive();
        this.nextArrival = this.time + between(this.rng, TIMING.arrivalGap);
      } else {
        this.nextArrival = this.time + TIMING.queueFullRetry;
      }
    }
  }

  /** 1 = full patience, 0 = about to lose a mood point. */
  patienceLeft(g: Guest): number {
    if (!g.phase) return 1;
    return clamp(1 - (g.waited - g.prevDropAt) / Math.max(1, g.nextDropAt - g.prevDropAt), 0, 1);
  }

  private arrive(): void {
    const g = createGuest(this.nextId++, weighted(this.rng, PERSONAS), this.menu, this.rng);
    this.guests.push(g);
    this.spawned++;
    this.toast('A guest just walked in. Greet them at the door.');
    this.emit({ type: 'arrived', guest: g });
  }

  private setState(g: Guest, state: GuestState): void {
    const phase = PHASE_OF[state];
    if (phase !== g.phase) {
      g.phase = phase;
      g.waited = 0;
      g.drops = 0;
      g.prevDropAt = 0;
      g.nextDropAt = phase ? patienceLimit(phase, g.persona) : 0;
      g.reassured = false;
    }
    g.state = state;
  }

  private changeMood(g: Guest, delta: number): void {
    const before = g.mood;
    g.mood = clamp(g.mood + delta, 0, TIMING.maxMood);
    if (delta < 0 && g.mood === 1 && before > 1) this.toast(`${where(g)} is losing patience.`, 'bad');
    if (g.mood === 0 && g.id !== this.activeGuestId) this.walkout(g);
  }

  // ------------------------------------------------------------- Talking

  /** Starts (or resumes) a conversation. Pauses this guest's patience. */
  talk(g: Guest, stage: Stage): Conversation {
    this.activeGuestId = g.id;
    if (g.talk && g.talkStage === stage && !g.talk.done) return g.talk;
    if (stage === 'order' && !g.plan) planOrder(g, this.menu, this.rng);
    const plan = g.plan ?? { recommend: false, allergy: false, conflict: false };
    g.talkStage = stage;
    g.talk = new Conversation({
      stage,
      nodes: nodesForStage(stage, plan),
      pack: this.pack,
      rng: this.rng,
      context: () => buildContext(g.order, this.pack, this.menu),
      pool: (node) => selectPool(node, g.persona.kind, g.mood),
      beforeNode: (node) => {
        if (node === 'conflictAccept' && g.order.conflictId && g.order.safeId) {
          g.order.dishIds = g.order.dishIds.map((id) => (id === g.order.conflictId ? g.order.safeId! : id));
        }
      },
    });
    const t = g.talk.turn!;
    g.log.push({ who: 'guest', text: t.guest.text, en: t.guest.en, clipId: t.guest.clipId });
    return g.talk;
  }

  /** The player picks option i. A right answer moves the clock by one line. */
  answer(g: Guest, i: number): ChooseResult {
    const talk = g.talk;
    if (!talk) return { kind: 'ignored' };
    const res = talk.choose(i);
    if (res.kind === 'wrong') {
      this.stats.wrongPicks++;
      g.log.push({ who: 'coach', ok: false, note: res.option.why ?? '' });
      if (!this.missed.some((m) => m.better === res.correct.text)) {
        this.missed.push({ said: res.option.text, better: res.correct.text, betterEn: res.correct.en, why: res.option.why ?? '' });
      }
      this.changeMood(g, -TIMING.wrongLinePenalty);
      if (g.mood === 0) g.log.push({ who: 'coach', ok: false, note: "That's it, they've had enough and are leaving." });
      this.emit({ type: 'answer', guest: g, correct: false });
    } else if (res.kind === 'right') {
      this.stats.turns++;
      if (res.firstTry) {
        this.stats.firstTry++;
        g.log.push({ who: 'coach', ok: true, note: 'Right choice.' });
      }
      g.log.push({ who: 'you', text: res.option.text, en: res.option.en, clipId: res.option.clipId });
      if (res.next) g.log.push({ who: 'guest', text: res.next.guest.text, en: res.next.guest.en, clipId: res.next.guest.clipId });
      this.tick(TIMING.lineSeconds);
      this.emit({ type: 'answer', guest: g, correct: true });
    }
    return res;
  }

  /**
   * Called when the talk panel closes. A finished conversation moves the
   * visit on; an unfinished one can be resumed. Mood 0 means they walk out.
   */
  endTalk(g: Guest): void {
    this.activeGuestId = null;
    if (g.mood === 0) {
      this.walkout(g);
      return;
    }
    if (!g.talk?.done) return;
    const stage = g.talkStage;
    g.talk = null;
    g.talkStage = null;
    if (stage === 'door') {
      this.setState(g, 'following');
      this.toast('The guest is following you. Walk to a free table.');
    } else if (stage === 'greet') {
      this.setState(g, 'drinks');
      this.toast(`Go to the drink station and pour Table ${g.table}'s drink.`);
    } else if (stage === 'order') {
      this.setState(g, 'ticket');
    } else if (stage === 'checkin') {
      g.checkedIn = true;
      this.stats.checkins++;
      this.changeMood(g, TIMING.checkinBonus);
      this.toast(`Table ${g.table} appreciates you checking in.`, 'good');
    } else if (stage === 'check') {
      this.payAndLeave(g);
    }
  }

  // ------------------------------------------------------------- Floor actions

  seat(g: Guest, table: number): void {
    if (g.state !== 'following' || this.guestAtTable(table)) return;
    g.table = table;
    this.setState(g, 'seated');
    this.toast(`Seated at Table ${table}. Greet them and get a drink order.`);
  }

  /** Telling a table their order is on the way buys a little time, once per wait. */
  reassure(g: Guest): void {
    if (g.reassured || !g.phase) return;
    g.reassured = true;
    g.waited = Math.max(g.prevDropAt, g.waited - TIMING.reassureBonus);
    this.toast(`You let Table ${g.table} know it's coming. That buys you a little time.`);
  }

  pour(g: Guest, drinkId: string): void {
    if (this.carrying || g.state !== 'drinks') return;
    this.carrying = { kind: 'drink', guestId: g.id, drinkId, walked: 0, rolled: false };
    this.toast(`Poured ${byId(this.menu, drinkId).names.en.order} for Table ${g.table}.`);
  }

  pickUp(g: Guest): void {
    if (this.carrying || g.state !== 'ready') return;
    this.carrying = { kind: 'food', guestId: g.id, walked: 0, rolled: false };
    this.setState(g, 'carrying');
    this.toast(`Got Table ${g.table}'s food. Careful with the tray.`);
  }

  sendTicket(g: Guest, dishIds: string[], flags: Allergen[]): void {
    if (g.state !== 'ticket' || dishIds.length === 0) return;
    g.ticket = { dishIds, flags };
    this.setState(g, 'cooking');
    g.readyAt = this.time + between(this.rng, TIMING.cookTime);
    this.toast(`Ticket in for Table ${g.table}. The kitchen needs about 6 to 9 minutes.`);
  }

  /** Serves what you're carrying to its guest. Returns true if the order-taking talk should open next. */
  serve(): boolean {
    const carry = this.carrying;
    const g = carry && this.guest(carry.guestId);
    if (!carry || !g) return false;
    this.carrying = null;
    const n = g.table;
    if (carry.kind === 'drink') {
      g.hasDrink = true;
      const ok = carry.drinkId === g.order.drinkId;
      this.emit({ type: 'served', guest: g, kind: 'drink', ok });
      if (!ok) {
        this.stats.wrongDrinks++;
        this.incidents.push(`Table ${n} got the wrong drink.`);
        this.toast(`Table ${n}: that's not the drink they ordered. They keep it, but they're not happy.`, 'bad');
        this.changeMood(g, -TIMING.wrongDrinkPenalty);
        if (g.mood === 0) return false;
      } else {
        this.toast(`Drink served to Table ${n}.`, 'good');
      }
      this.setState(g, 'ordering');
      return true;
    }

    const ticket = g.ticket ?? { dishIds: [], flags: [] };
    const want = [...g.order.dishIds].sort().join();
    const got = [...ticket.dishIds].sort().join();
    const a = g.order.allergy;
    if (a) {
      const risky = ticket.dishIds.some((id) => byId(this.menu, id).allergens.includes(a));
      const flagged = ticket.flags.includes(a);
      if (risky && !flagged) {
        this.stats.allergyReactions++;
        this.incidents.push(`Table ${n} had an allergic reaction (${a}). The allergy wasn't flagged on the ticket.`);
        this.toast(`Table ${n} is having an allergic reaction to ${a}. The manager takes over and the guest leaves.`, 'bad');
        this.emit({ type: 'served', guest: g, kind: 'food', ok: false });
        this.leave(g, { outcome: 'allergic reaction', tip: 0, stars: 0, bill: 0 });
        return false;
      }
      if (flagged) {
        this.changeMood(g, TIMING.allergyFlaggedBonus);
        this.toast(`You flagged the ${a} allergy, so the kitchen kept Table ${n}'s plate safe.`, 'good');
      } else {
        this.stats.unflaggedAllergies++;
        this.incidents.push(`Table ${n}'s ${a} allergy wasn't flagged. The food happened to be safe this time.`);
        this.toast(`Table ${n}'s food happened to be ${a}-free, but flag allergies on every ticket.`, 'bad');
      }
    }
    const ok = want === got;
    this.emit({ type: 'served', guest: g, kind: 'food', ok });
    if (!ok) {
      this.stats.wrongDishes++;
      this.incidents.push(`Table ${n} got the wrong food. The ticket didn't match their order.`);
      this.toast(`Table ${n}: that's not what they ordered.`, 'bad');
      this.changeMood(g, -TIMING.wrongDishPenalty);
      if (g.mood === 0) return false;
    } else {
      this.toast(`Served Table ${n}. They'll eat for a while now.`, 'good');
    }
    this.setState(g, 'eating');
    g.doneAt = this.time + between(this.rng, TIMING.eatTime);
    return false;
  }

  /** Call as the waiter walks while carrying. Returns true when an accident should start. */
  carryProgress(metres: number): boolean {
    const c = this.carrying;
    if (!c || c.rolled) return false;
    c.walked += metres;
    if (c.walked < TIMING.accident.afterWalking) return false;
    c.rolled = true;
    return this.rng() < TIMING.accident.chance;
  }

  /** Outcome of the quick reaction prompt. */
  accident(saved: boolean): void {
    const c = this.carrying;
    if (!c) return;
    if (saved) {
      this.stats.saves++;
      this.toast('Nice save.', 'good');
      this.emit({ type: 'saved' });
      return;
    }
    this.carrying = null;
    this.stats.spills++;
    const g = this.guest(c.guestId);
    this.emit({ type: 'spill', kind: c.kind, drinkId: c.kind === 'drink' ? c.drinkId : undefined });
    if (!g) return;
    this.incidents.push(`You spilled Table ${g.table}'s ${c.kind}.`);
    if (c.kind === 'food') {
      this.setState(g, 'cooking');
      g.readyAt = this.time + TIMING.remakeTime;
      this.toast(`Dropped it. The kitchen is remaking Table ${g.table}'s food, about 4 minutes.`, 'bad');
    } else {
      this.toast(`Spilled Table ${g.table}'s drink. Pour another one.`, 'bad');
    }
    this.changeMood(g, -TIMING.spillPenalty);
  }

  // ------------------------------------------------------------- Leaving

  bill(g: Guest): number {
    return g.order.dishIds.reduce((s, id) => s + byId(this.menu, id).price, 0) + byId(this.menu, g.order.drinkId).price;
  }

  private payAndLeave(g: Guest): void {
    const bill = this.bill(g);
    const tip = Math.round(bill * TIMING.tipPercentByMood[g.mood]) / 100;
    this.toast(`Table ${g.table} paid $${bill.toFixed(2)} and left $${tip.toFixed(2)}.`, tip > 0 ? 'good' : 'bad');
    this.leave(g, { outcome: 'served', tip, stars: g.mood, bill });
  }

  private walkout(g: Guest): void {
    this.stats.walkouts++;
    this.incidents.push(`${where(g)} walked out.`);
    this.toast(`${where(g)} walked out.`, 'bad');
    this.leave(g, { outcome: 'walked out', tip: 0, stars: 0, bill: 0 });
  }

  private leave(g: Guest, r: Omit<VisitRecord, 'table' | 'persona'>): void {
    if (!this.guests.includes(g)) return;
    if (this.carrying?.guestId === g.id) this.carrying = null;
    if (this.activeGuestId === g.id) this.activeGuestId = null;
    const record: VisitRecord = { table: g.table, persona: g.persona.label, ...r };
    this.records.push(record);
    this.tips += r.tip;
    this.guests = this.guests.filter((x) => x !== g);
    this.emit({ type: 'left', guest: g, record });
    if (this.records.length >= this.total && !this.over) {
      this.over = true;
      this.emit({ type: 'over' });
    }
  }
}
