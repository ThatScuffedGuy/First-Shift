import type { Allergen, Menu, MenuItem } from '../data/types';
import type { LanguagePack, TokenContext, TokenName } from './types';
import { joinList } from './fill';

/** The facts about one guest's order that dialogue lines can mention. */
export interface OrderFacts {
  drinkId: string;
  /** A different drink, used in a "you misheard" wrong reply. */
  otherDrinkId: string;
  dishIds: string[];
  recId?: string;
  conflictId?: string;
  safeId?: string;
  allergy: Allergen | null;
}

export const itemById = (menu: Menu, id: string): MenuItem => {
  const item = menu.items.find((m) => m.id === id);
  if (!item) throw new Error(`Menu "${menu.id}" has no item "${id}"`);
  return item;
};

/** Builds the token values ({drink}, {dishes}...) for a guest in a language. */
export function buildContext(f: OrderFacts, pack: LanguagePack, menu: Menu): TokenContext {
  const form = (t: TokenName) => pack.tokenForms?.[t] ?? 'order';
  const name = (item: MenuItem, lang: string, t: TokenName) => {
    const n = item.names[lang];
    if (!n) throw new Error(`Menu item "${item.id}" has no ${lang} name`);
    return lang === 'en' ? n.order : n[form(t)];
  };
  const one = (t: TokenName, id?: string) => {
    if (!id) return undefined;
    const item = itemById(menu, id);
    return { text: name(item, pack.code, t), en: name(item, 'en', t), key: id };
  };
  const dishes = f.dishIds.map((id) => itemById(menu, id));
  const drinks = menu.items.filter((m) => m.category === 'drink');
  const ctx: TokenContext = {
    drink: one('drink', f.drinkId),
    otherDrink: one('otherDrink', f.otherDrinkId),
    rec: one('rec', f.recId),
    safe: one('safe', f.safeId),
    conflict: one('conflict', f.conflictId),
    dishes: {
      text: joinList(dishes.map((d) => name(d, pack.code, 'dishes')), pack.listAnd),
      en: joinList(dishes.map((d) => name(d, 'en', 'dishes')), ' and '),
      key: f.dishIds.join('+'),
    },
    drinkList: {
      text: joinList(drinks.map((d) => d.names[pack.code]?.plain ?? d.id), pack.listAnd),
      en: joinList(drinks.map((d) => d.names.en.plain), ' and '),
      key: menu.id,
    },
  };
  if (f.allergy) {
    const a = pack.allergens[f.allergy];
    ctx.allergy = { text: a.phrase, en: f.allergy, key: f.allergy.replace(' ', '-') };
    ctx.allergyNoun = { text: a.noun, en: f.allergy, key: f.allergy.replace(' ', '-') };
  }
  return ctx;
}
