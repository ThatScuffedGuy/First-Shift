import { RANKS, MASTERY_STREAK } from './data/ranks';
import type { Menu } from './data/types';

/**
 * Progress saved on this device between shifts: results of past shifts and
 * a practice deck of lines you got wrong. Lost if the browser's site data is
 * cleared; never sent anywhere.
 */
export interface CardOption {
  text: string;
  en: string;
  correct: boolean;
  why?: string;
  clipId?: string;
}

export interface PracticeCard {
  key: string;
  lang: string;
  guest: string;
  guestEn: string;
  guestClip?: string;
  options: CardOption[];
  misses: number;
  /** First-try answers in a row since the last miss. */
  streak: number;
  lastMissed: number;
}

export interface ShiftLog {
  date: string;
  lang: string;
  difficulty: string;
  served: number;
  total: number;
  tips: number;
  rating: number;
  firstTry: number;
  turns: number;
}

export interface Progress {
  version: 1;
  shifts: ShiftLog[];
  cards: Record<string, PracticeCard>;
  /** Real restaurant menus you've imported. */
  menus?: Menu[];
}

const KEY = 'first-shift.progress';

function load(): Progress {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p?.version === 1) return p;
    }
  } catch {
    // Storage blocked or corrupt: start fresh.
  }
  return { version: 1, shifts: [], cards: {} };
}

const data: Progress = load();
const listeners: (() => void)[] = [];

function save(): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    // Not saved (private window or storage full); still works for this visit.
  }
  for (const fn of listeners) fn();
}

/** Combines two saves without losing anything: all shifts, every practice line, every menu. */
export function mergeProgress(a: Progress, b: Progress): Progress {
  const shifts = new Map<string, ShiftLog>();
  for (const s of [...a.shifts, ...b.shifts]) shifts.set(`${s.date}|${s.lang}`, s);
  const cards: Record<string, PracticeCard> = { ...a.cards };
  for (const [key, card] of Object.entries(b.cards)) {
    const mine = cards[key];
    if (!mine) cards[key] = card;
    else {
      const newer = card.lastMissed > mine.lastMissed ? card : mine;
      cards[key] = { ...newer, misses: Math.max(mine.misses, card.misses), streak: card.lastMissed === mine.lastMissed ? Math.max(mine.streak, card.streak) : newer.streak };
    }
  }
  const menus = new Map<string, Menu>();
  for (const m of [...(a.menus ?? []), ...(b.menus ?? [])]) menus.set(m.id, m);
  return {
    version: 1,
    shifts: [...shifts.values()].sort((x, y) => x.date.localeCompare(y.date)).slice(-200),
    cards,
    menus: [...menus.values()],
  };
}

const cardKey = (lang: string, guest: string) => `${lang}|${guest}`;

export const progress = {
  /** Called after every change (used to sync with your account). */
  onChange(fn: () => void): void {
    listeners.push(fn);
  },

  /** A copy of everything, for saving online. */
  export(): Progress {
    return JSON.parse(JSON.stringify(data));
  },

  /** Merges a save from your account into this device's progress. */
  mergeIn(other: unknown): void {
    const o = other as Progress | null;
    if (!o || o.version !== 1 || !Array.isArray(o.shifts) || typeof o.cards !== 'object') return;
    Object.assign(data, mergeProgress(data, o));
    save();
  },

  menus(): Menu[] {
    return data.menus ?? [];
  },

  addMenu(menu: Menu): void {
    data.menus = [...(data.menus ?? []).filter((m) => m.id !== menu.id), menu];
    save();
  },

  removeMenu(id: string): void {
    data.menus = (data.menus ?? []).filter((m) => m.id !== id);
    save();
  },

  shifts(): ShiftLog[] {
    return data.shifts;
  },

  recordShift(log: ShiftLog): void {
    data.shifts.push(log);
    if (data.shifts.length > 200) data.shifts.splice(0, data.shifts.length - 200);
    save();
  },

  /** A wrong pick: add the line to the practice deck (or reset its streak). */
  recordMiss(lang: string, guest: { text: string; en: string; clipId?: string }, options: CardOption[]): void {
    const key = cardKey(lang, guest.text);
    const card = data.cards[key] ?? { key, lang, guest: guest.text, guestEn: guest.en, guestClip: guest.clipId, options: [], misses: 0, streak: 0, lastMissed: 0 };
    card.options = options.map(({ text, en, correct, why, clipId }) => ({ text, en, correct, why, clipId }));
    card.misses++;
    card.streak = 0;
    card.lastMissed = Date.now();
    data.cards[key] = card;
    save();
  },

  /** A first-try answer to a line that's in the deck counts towards learning it. */
  recordFirstTry(lang: string, guestText: string): void {
    const card = data.cards[cardKey(lang, guestText)];
    if (!card) return;
    card.streak++;
    save();
  },

  toPractice(lang?: string): PracticeCard[] {
    return Object.values(data.cards)
      .filter((c) => c.streak < MASTERY_STREAK && (!lang || c.lang === lang))
      .sort((a, b) => b.lastMissed - a.lastMissed);
  },

  learnedCount(lang?: string): number {
    return Object.values(data.cards).filter((c) => c.streak >= MASTERY_STREAK && (!lang || c.lang === lang)).length;
  },

  totals(lang?: string) {
    const list = data.shifts.filter((s) => !lang || s.lang === lang);
    return {
      shifts: list.length,
      served: list.reduce((a, s) => a + s.served, 0),
      tips: list.reduce((a, s) => a + s.tips, 0),
      bestTips: list.reduce((a, s) => Math.max(a, s.tips), 0),
      firstTry: list.reduce((a, s) => a + s.firstTry, 0),
      turns: list.reduce((a, s) => a + s.turns, 0),
    };
  },

  /** Current title and how far to the next one, by total guests served. */
  rank(): { title: string; served: number; next?: { title: string; from: number } } {
    const served = this.totals().served;
    let i = 0;
    while (i + 1 < RANKS.length && served >= RANKS[i + 1].from) i++;
    return { title: RANKS[i].title, served, next: RANKS[i + 1] };
  },
};
