import { describe, expect, it } from 'vitest';
import { checkCredentials, hashPassword, newToken, randomHex, safeEqual, sha256 } from '../server/src/auth';
import { LANGUAGE_RULES, menuPrompt, normalizeMenu } from '../server/src/menuImport';
import { LANGUAGES } from '../src/data/languages';

describe('passwords and sessions', () => {
  it('hashes the same password the same way with the same salt, differently with another', async () => {
    const salt = randomHex(16);
    const a = await hashPassword('correct horse', salt);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(await hashPassword('correct horse', salt)).toBe(a);
    expect(await hashPassword('correct horse', randomHex(16))).not.toBe(a);
    expect(await hashPassword('wrong horse', salt)).not.toBe(a);
  });

  it('makes random tokens and stores only their hash', async () => {
    const { token, hash } = await newToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).toBe(await sha256(token));
    expect((await newToken()).token).not.toBe(token);
  });

  it('compares safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('abc', 'ab')).toBe(false);
  });

  it('checks usernames and passwords', () => {
    expect(checkCredentials('waiter_1', 'longenough')).toBeNull();
    expect(checkCredentials('ab', 'longenough')).toMatch(/3 to 20/);
    expect(checkCredentials('bad name', 'longenough')).toMatch(/3 to 20/);
    expect(checkCredentials('waiter', 'short')).toMatch(/8 characters/);
  });
});

describe('menu import', () => {
  const names = (en: string) => Object.fromEntries(Object.keys(LANGUAGE_RULES).map((c) => [c, { order: `the ${en}`, plain: en }]));
  const item = (category: string, en: string, extra: object = {}) => ({ category, price: 12, description: en, allergens: ['gluten', 'made-up'], names: names(en), ...extra });

  it('asks for names in every language the game has', () => {
    for (const l of LANGUAGES) expect(Object.keys(LANGUAGE_RULES)).toContain(l.code);
    expect(menuPrompt('Pizza 10')).toContain('Pizza 10');
  });

  it('cleans a good answer into a usable menu', () => {
    const res = normalizeMenu({ name: 'Trattoria', items: [item('main', 'pizza'), item('main', 'pizza'), item('drink', 'cola'), item('starter', 'soup', { price: 'free' })] });
    expect('menu' in res).toBe(true);
    if (!('menu' in res)) return;
    const ids = res.menu.items.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(res.menu.items[0].allergens).toEqual(['gluten']);
    expect(res.menu.items[3].price).toBe(15);
    for (const i of res.menu.items) expect(i.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('drops items missing a language and rejects menus without 2 mains', () => {
    const broken = item('main', 'stew');
    delete (broken.names as Record<string, unknown>).ru;
    const res = normalizeMenu({ items: [item('main', 'pizza'), broken, item('drink', 'tea')] });
    expect('error' in res).toBe(true);
  });

  it('reads JSON wrapped in extra text, and rejects nonsense', () => {
    const wrapped = `Here you go: ${JSON.stringify({ items: [item('main', 'a'), item('main', 'b')] })} enjoy`;
    expect('menu' in normalizeMenu(wrapped)).toBe(true);
    expect('error' in normalizeMenu('no menu here')).toBe(true);
  });

  it('strips markup, and drops names with braces that could break the game', () => {
    const res = normalizeMenu({ items: [item('main', '<b>pizza</b>'), item('main', '{drink} pasta'), item('main', 'risotto')] });
    expect('menu' in res).toBe(true);
    if ('menu' in res) {
      expect(res.menu.items.map((i) => i.names.en.plain)).toEqual(['b pizza /b', 'risotto']);
    }
  });
});

import { mergeProgress, type Progress } from '../src/progress';

describe('merging saves', () => {
  const shift = (date: string) => ({ date, lang: 'es', difficulty: 'normal', served: 3, total: 5, tips: 10, rating: 3, firstTry: 5, turns: 6 });
  const card = (key: string, misses: number, streak: number, lastMissed: number) => ({ key, lang: 'es', guest: key, guestEn: key, options: [], misses, streak, lastMissed });

  it('keeps every shift, practice line and menu from both sides', () => {
    const a: Progress = { version: 1, shifts: [shift('2026-01-01'), shift('2026-01-02')], cards: { x: card('x', 1, 0, 10) }, menus: [{ id: 'm1', name: 'A', items: [] }] };
    const b: Progress = { version: 1, shifts: [shift('2026-01-02'), shift('2026-01-03')], cards: { x: card('x', 3, 1, 20), y: card('y', 1, 0, 5) }, menus: [{ id: 'm2', name: 'B', items: [] }] };
    const m = mergeProgress(a, b);
    expect(m.shifts.map((s) => s.date)).toEqual(['2026-01-01', '2026-01-02', '2026-01-03']);
    expect(Object.keys(m.cards).sort()).toEqual(['x', 'y']);
    expect(m.cards.x.misses).toBe(3);
    expect(m.cards.x.streak).toBe(1); // from the more recent miss
    expect(m.menus!.map((x) => x.id).sort()).toEqual(['m1', 'm2']);
  });
});
