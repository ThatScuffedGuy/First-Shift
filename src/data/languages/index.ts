import type { LanguagePack } from '../../dialogue/types';

/**
 * Every *.json file in this folder is a language. Drop in a new file (copy
 * es.json and translate it) and it appears in the game automatically.
 */
const files = import.meta.glob<LanguagePack>('./*.json', { eager: true, import: 'default' });

export const LANGUAGES: LanguagePack[] = Object.values(files).sort((a, b) => a.label.localeCompare(b.label));

export function languageByCode(code: string): LanguagePack {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
