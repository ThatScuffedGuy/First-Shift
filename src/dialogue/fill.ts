import type { LanguagePack, TokenContext, TokenName } from './types';
import { TOKENS } from './types';

const TOKEN_RE = /\{(\w+)\}/g;

const capitalize = (s: string) => (s ? s[0].toLocaleUpperCase() + s.slice(1) : s);

/** Which tokens a line uses, lower-cased and sorted ({Drink} counts as drink). */
export function usedTokens(template: string): TokenName[] {
  const found = new Set<TokenName>();
  for (const m of template.matchAll(TOKEN_RE)) {
    const name = (m[1][0].toLowerCase() + m[1].slice(1)) as TokenName;
    if ((TOKENS as readonly string[]).includes(name)) found.add(name);
  }
  return [...found].sort();
}

/** Names of {tokens} in a line that the game doesn't know (typos). */
export function unknownTokens(template: string): string[] {
  const bad: string[] = [];
  for (const m of template.matchAll(TOKEN_RE)) {
    const name = m[1][0].toLowerCase() + m[1].slice(1);
    if (!(TOKENS as readonly string[]).includes(name)) bad.push(m[1]);
  }
  return bad;
}

/**
 * Replaces {tokens} with names from the context. A capitalised token like
 * {Drink} capitalises the inserted text, for tokens at the start of a sentence.
 * Unknown or missing tokens are left as they are, so tests can catch them.
 */
export function fill(template: string, ctx: TokenContext, which: 'text' | 'en'): string {
  return template.replace(TOKEN_RE, (whole, raw: string) => {
    const name = (raw[0].toLowerCase() + raw.slice(1)) as TokenName;
    const value = ctx[name];
    if (!value) return whole;
    const s = value[which];
    return raw[0] === raw[0].toUpperCase() ? capitalize(s) : s;
  });
}

/** "a, b and c" in the given language. Spanish "y" becomes "e" before an "i" sound. */
export function joinList(items: string[], and: string): string {
  if (items.length < 2) return items.join('');
  const last = items[items.length - 1];
  let joiner = and;
  if (and.trim() === 'y' && /^h?i(?![aeiouáéíóú])/i.test(last)) joiner = and.replace('y', 'e');
  return items.slice(0, -1).join(', ') + joiner + last;
}

/**
 * Stable ID for a recorded clip of a spoken line. Lines with tokens get the
 * token values appended, because each filled version is a different recording:
 *   es/door.polite.1.guest
 *   es/drinkOrder.polite.1.reply~drink-lemonade
 */
export function clipId(pack: Pick<LanguagePack, 'code'>, lineId: string, role: 'guest' | 'reply', template: string, ctx: TokenContext): string {
  const parts = usedTokens(template)
    .map((t) => `${t}-${ctx[t]?.key ?? 'missing'}`)
    .join('~');
  return `${pack.code}/${lineId}.${role}${parts ? '~' + parts : ''}`;
}
