/**
 * Checks every dialogue file in src/data/languages. Run with `npm test`.
 * If you add or edit lines and this fails, the message says which line and why.
 */
import { describe, expect, it } from 'vitest';
import { LANGUAGES } from '../src/data/languages';
import { MENUS } from '../src/data/menus';
import { ALLERGENS } from '../src/data/types';
import { NODES, POOLS, TOKENS, type TokenName } from '../src/dialogue/types';
import { buildContext } from '../src/dialogue/context';
import { fill, unknownTokens, usedTokens } from '../src/dialogue/fill';
import { CONDITIONAL_TOKENS, allVariants, factsFor, wrongsFor } from '../src/dialogue/expand';

/** Words that must never appear, even from rude guests. */
const BANNED = ['fuck', 'shit', 'bitch', 'bastard', 'mierda', 'joder', 'puta', 'coño', 'gilipollas', 'cabrón', 'pendejo', 'блять', 'бля', 'хуй', 'сука', 'пизд', 'ебат', 'говно', 'мудак'];

const where = (lang: string, id: string) => `[${lang}] ${id}`;

describe('dialogue files', () => {
  it('there are at least two languages', () => {
    expect(LANGUAGES.map((l) => l.code)).toEqual(expect.arrayContaining(['es', 'ru']));
  });

  for (const pack of LANGUAGES) {
    describe(`${pack.label} (${pack.code})`, () => {
      it('has every dialogue node, and no unknown ones', () => {
        expect(Object.keys(pack.nodes).sort()).toEqual([...NODES].sort());
      });

      it('says every allergy', () => {
        for (const a of ALLERGENS) {
          expect(pack.allergens[a]?.phrase, where(pack.code, `allergens.${a}.phrase`)).toBeTruthy();
          expect(pack.allergens[a]?.noun, where(pack.code, `allergens.${a}.noun`)).toBeTruthy();
        }
      });

      it('has the basics: label, speech language, list joiner and test line', () => {
        expect(pack.label).toBeTruthy();
        expect(pack.speechLang).toMatch(/^[a-z]{2,3}(-[A-Z]{2})?$/);
        expect(pack.listAnd).toMatch(/^ .+ $/);
        expect(pack.testLine).toBeTruthy();
        for (const t of Object.keys(pack.tokenForms ?? {})) expect(TOKENS).toContain(t);
      });

      it('has group (party) lines in every node, and says group sizes', () => {
        for (const node of NODES) expect(pack.nodes[node].lines.party?.length, where(pack.code, `${node}.party is missing`)).toBeGreaterThan(0);
        for (const n of ['2', '3', '4'] as const) expect(pack.partyWords?.[n], where(pack.code, `partyWords.${n}`)).toBeTruthy();
      });

      it('uses only known line pools, with several polite variants per node', () => {
        for (const node of NODES) {
          for (const pool of Object.keys(pack.nodes[node].lines)) expect(POOLS, where(pack.code, `${node}.${pool}`)).toContain(pool);
          expect(pack.nodes[node].lines.polite.length, where(pack.code, `${node}.polite needs at least 2 variants`)).toBeGreaterThanOrEqual(2);
        }
      });

      it('gives every line a unique, stable ID that starts with its node and pool', () => {
        const seen = new Set<string>();
        for (const ref of allVariants(pack)) {
          const id = ref.variant.id;
          expect(seen.has(id), where(pack.code, `duplicate ID ${id}`)).toBe(false);
          seen.add(id);
          expect(id.startsWith(`${ref.node}.${ref.pool}.`), where(pack.code, `${id} should start with ${ref.node}.${ref.pool}.`)).toBe(true);
          for (const w of ref.variant.wrong ?? []) {
            expect(seen.has(w.id), where(pack.code, `duplicate ID ${w.id}`)).toBe(false);
            seen.add(w.id);
          }
        }
        for (const node of NODES) for (const w of pack.nodes[node].wrong) {
          expect(seen.has(w.id), where(pack.code, `duplicate ID ${w.id}`)).toBe(false);
          seen.add(w.id);
        }
      });

      it('gives every guest line exactly one correct reply, with English for both', () => {
        for (const { variant: v } of allVariants(pack)) {
          for (const k of ['guest', 'guestEn', 'reply', 'replyEn'] as const) {
            expect(typeof v[k] === 'string' && v[k].trim().length > 0, where(pack.code, `${v.id}.${k} is missing`)).toBe(true);
          }
        }
      });

      it('offers at least two wrong replies per line, none identical to the right one', () => {
        for (const ref of allVariants(pack)) {
          const wrongs = wrongsFor(pack, ref);
          expect(wrongs.length, where(pack.code, `${ref.variant.id} needs 2+ wrong replies`)).toBeGreaterThanOrEqual(2);
          for (const w of wrongs) expect(w.text, where(pack.code, `${w.id} is the same as the correct reply to ${ref.variant.id}`)).not.toBe(ref.variant.reply);
        }
      });

      it('explains every wrong reply in one English sentence', () => {
        const all = [...NODES.flatMap((n) => pack.nodes[n].wrong), ...allVariants(pack).flatMap((r) => r.variant.wrong ?? [])];
        for (const w of all) {
          expect(w.text?.trim(), where(pack.code, `${w.id}.text`)).toBeTruthy();
          expect(w.en?.trim(), where(pack.code, `${w.id}.en`)).toBeTruthy();
          expect(w.why?.trim(), where(pack.code, `${w.id}.why is missing`)).toBeTruthy();
          expect(w.why.length, where(pack.code, `${w.id}.why is too long for one sentence`)).toBeLessThan(220);
          expect(w.why, where(pack.code, `${w.id}.why should end with a full stop`)).toMatch(/[.!?]$/);
        }
      });

      it('spells every {token} correctly and only uses tokens available in that step', () => {
        for (const ref of allVariants(pack)) {
          const texts = [ref.variant.guest, ref.variant.guestEn, ref.variant.reply, ref.variant.replyEn, ...wrongsFor(pack, ref).flatMap((w) => [w.text, w.en, w.why])];
          for (const t of texts) {
            expect(unknownTokens(t), where(pack.code, `${ref.variant.id}: unknown token in "${t}"`)).toEqual([]);
            for (const tok of usedTokens(t)) {
              if (tok === 'party') expect(ref.pool, where(pack.code, `${ref.variant.id}: {party} only works in group (party) lines`)).toBe('party');
              const allowed = CONDITIONAL_TOKENS[tok];
              if (allowed) expect(allowed, where(pack.code, `${ref.variant.id}: {${tok}} isn't known during "${ref.node}"`)).toContain(ref.node);
            }
          }
        }
      });

      it('leaves no {token} unfilled, for every menu combination', () => {
        for (const menu of MENUS) {
          for (const ref of allVariants(pack)) {
            const wrongs = wrongsFor(pack, ref);
            const texts: [string, 'text' | 'en'][] = [
              [ref.variant.guest, 'text'], [ref.variant.reply, 'text'], [ref.variant.guestEn, 'en'], [ref.variant.replyEn, 'en'],
              ...wrongs.flatMap((w) => [[w.text, 'text'], [w.en, 'en'], [w.why, 'en']] as [string, 'text' | 'en'][]),
            ];
            const used = new Set<TokenName>(texts.flatMap(([t]) => usedTokens(t)));
            for (const facts of factsFor(used, menu, ref.pool === 'party')) {
              const ctx = buildContext(facts, pack, menu);
              for (const [t, which] of texts) {
                const out = fill(t, ctx, which);
                expect(out, where(pack.code, `${ref.variant.id}: "${out}"`)).not.toMatch(/[{}]/);
              }
            }
          }
        }
      });

      it('keeps rude guests free of profanity', () => {
        const all = JSON.stringify(pack).toLowerCase();
        for (const word of BANNED) expect(all.includes(word), where(pack.code, `contains "${word}"`)).toBe(false);
      });
    });
  }
});

describe('menus', () => {
  for (const menu of MENUS) {
    it(`"${menu.name}" names every item in every language`, () => {
      for (const item of menu.items) {
        for (const code of ['en', ...LANGUAGES.map((l) => l.code)]) {
          expect(item.names[code]?.order, `${item.id} has no ${code}.order name`).toBeTruthy();
          expect(item.names[code]?.plain, `${item.id} has no ${code}.plain name`).toBeTruthy();
        }
        for (const a of item.allergens) expect(ALLERGENS).toContain(a);
      }
    });
    it(`"${menu.name}" has at least 2 drinks and 2 mains`, () => {
      expect(menu.items.filter((m) => m.category === 'drink').length).toBeGreaterThanOrEqual(2);
      expect(menu.items.filter((m) => m.category === 'main').length).toBeGreaterThanOrEqual(2);
    });
  }
});
