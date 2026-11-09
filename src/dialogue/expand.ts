import type { Allergen, Menu, MenuItem } from '../data/types';
import { buildContext, type OrderFacts } from './context';
import { clipId, fill, usedTokens } from './fill';
import type { LanguagePack, NodeName, Pool, TokenName, Variant, WrongReply } from './types';

/**
 * Tokens that only exist in some conversations. {drink}, {dishes} and
 * {drinkList} are always known; these depend on how the order goes.
 */
export const CONDITIONAL_TOKENS: Partial<Record<TokenName, NodeName[]>> = {
  rec: ['askRec', 'acceptRec'],
  allergy: ['allergyYes', 'allergyConflict', 'conflictAccept'],
  allergyNoun: ['allergyYes', 'allergyConflict', 'conflictAccept'],
  conflict: ['allergyConflict', 'conflictAccept'],
  safe: ['allergyConflict', 'conflictAccept'],
};

const byCat = (menu: Menu, cat: MenuItem['category']) => menu.items.filter((m) => m.category === cat);

/**
 * Every combination of order facts that changes how the given tokens read.
 * Used to check that every filled line works, and to list lines to record.
 */
export function factsFor(used: Set<TokenName>, menu: Menu, group = false): OrderFacts[] {
  const drinks = byCat(menu, 'drink');
  const mains = byCat(menu, 'main');
  const starters = byCat(menu, 'starter');
  const foods = menu.items.filter((m) => m.category !== 'drink');
  let list: OrderFacts[] = [{ drinkIds: [drinks[0].id], otherDrinkId: drinks[1].id, dishIds: [mains[0].id], allergy: null }];
  const expand = (fn: (f: OrderFacts) => OrderFacts[]) => (list = list.flatMap(fn));

  if (group) {
    // Groups of 2 to 4: one drink and main each. A few sample orders are enough to check the lines.
    list = [2, 3, 4].map((n) => ({ drinkIds: drinks.slice(0, n).map((d) => d.id), otherDrinkId: drinks[n % drinks.length].id, dishIds: mains.slice(0, n).map((m) => m.id), allergy: null, size: n }));
  } else if (used.has('drink') || used.has('otherDrink')) {
    expand((f) =>
      drinks.flatMap((d) => (used.has('otherDrink') ? drinks.filter((o) => o !== d) : [drinks.find((o) => o !== d)!]).map((o) => ({ ...f, drinkIds: [d.id], otherDrinkId: o.id }))),
    );
  }
  if (used.has('dishes') && !group) {
    const combos = [...mains.map((m) => [m.id]), ...starters.flatMap((s) => mains.map((m) => [s.id, m.id]))];
    expand((f) => combos.map((dishIds) => ({ ...f, dishIds })));
  }
  if (used.has('rec')) expand((f) => mains.map((m) => ({ ...f, recId: m.id })));
  if (used.has('allergy') || used.has('allergyNoun') || used.has('conflict') || used.has('safe')) {
    const present = [...new Set(foods.flatMap((m) => m.allergens))] as Allergen[];
    const withConflict = used.has('conflict') || used.has('safe');
    expand((f) =>
      present.flatMap((a) => {
        if (!withConflict) return [{ ...f, allergy: a }];
        return foods
          .filter((c) => c.allergens.includes(a))
          .flatMap((c) => {
            const same = menu.items.filter((s) => s.category === c.category && !s.allergens.includes(a));
            const safe = same.length ? same : mains.filter((s) => !s.allergens.includes(a));
            return safe.map((s) => ({ ...f, allergy: a, conflictId: c.id, safeId: s.id }));
          });
      }),
    );
  }
  return list;
}

export interface LineRef {
  node: NodeName;
  pool: Pool;
  variant: Variant;
}

/** Every variant in a language, with its node and pool. */
export function allVariants(pack: LanguagePack): LineRef[] {
  return (Object.keys(pack.nodes) as NodeName[]).flatMap((node) =>
    (Object.entries(pack.nodes[node].lines) as [Pool, Variant[]][]).flatMap(([pool, variants]) => variants.map((variant) => ({ node, pool, variant }))),
  );
}

/** All wrong replies offered for a variant (its own plus the node's). */
export const wrongsFor = (pack: LanguagePack, ref: LineRef): WrongReply[] => [...(ref.variant.wrong ?? []), ...pack.nodes[ref.node].wrong];

export interface RecordableLine {
  clipId: string;
  node: NodeName;
  pool: Pool;
  role: 'guest' | 'reply';
  text: string;
  en: string;
  /** True for lines with no {tokens}: one recording covers every shift. */
  fixed: boolean;
}

/**
 * Every spoken line that could ever play, filled in for every menu combination.
 * Wrong replies are never spoken, so they're not included.
 */
export function recordableLines(pack: LanguagePack, menu: Menu): RecordableLine[] {
  const out = new Map<string, RecordableLine>();
  for (const ref of allVariants(pack)) {
    for (const role of ['guest', 'reply'] as const) {
      const template = role === 'guest' ? ref.variant.guest : ref.variant.reply;
      const templateEn = role === 'guest' ? ref.variant.guestEn : ref.variant.replyEn;
      const used = new Set(usedTokens(template));
      const group = ref.pool === 'party';
      // Group orders have too many drink and dish combinations to record; the device voice reads those.
      if (group && (used.has('drink') || used.has('dishes'))) continue;
      for (const facts of factsFor(used, menu, group)) {
        const ctx = buildContext(facts, pack, menu);
        const id = clipId(pack, ref.variant.id, role, template, ctx);
        if (!out.has(id)) out.set(id, { clipId: id, node: ref.node, pool: ref.pool, role, text: fill(template, ctx, 'text'), en: fill(templateEn, ctx, 'en'), fixed: used.size === 0 });
      }
    }
  }
  return [...out.values()];
}
