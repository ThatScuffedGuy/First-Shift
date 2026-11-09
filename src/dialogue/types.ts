import type { Allergen } from '../data/types';

/**
 * Format of a language file in src/data/languages/<code>.json.
 * To add a language, copy an existing file, translate it, and add the
 * language's names to every menu item. No code changes needed.
 */
export interface LanguagePack {
  /** Short code, e.g. "es". Also the folder name for recorded audio. */
  code: string;
  /** English name shown in the game, e.g. "Spanish". */
  label: string;
  /** Language tag for the device's speech voice, e.g. "es-ES". */
  speechLang: string;
  /** Word joining the last two items of a list, with spaces, e.g. " y ". */
  listAnd: string;
  /** Line played by the "Test sound" button. */
  testLine: string;
  /**
   * Which name form each token uses (see ItemName). Default is "order".
   * Russian uses "plain" for {conflict} because that sentence needs the nominative case.
   */
  tokenForms?: Partial<Record<TokenName, 'order' | 'plain'>>;
  /** How each allergy is said: after "I'm allergic" ("al gluten", "на глютен") and as a bare noun. */
  allergens: Record<Allergen, { phrase: string; noun: string }>;
  nodes: Record<NodeName, DialogueNode>;
}

/** One step of a conversation: the guest says something, you pick the reply. */
export interface DialogueNode {
  /** Guest lines grouped by who says them. "polite" is required; the others are optional. */
  lines: Partial<Record<Pool, Variant[]>> & { polite: Variant[] };
  /** Learner mistakes offered as wrong options for every line in this node. */
  wrong: WrongReply[];
}

/**
 * "polite" is the default. Persona pools replace it for that persona.
 * "impatient" is used by anyone whose mood has dropped to 2 or below.
 */
export const POOLS = ['polite', 'warm', 'rushed', 'rude', 'indecisive', 'tourist', 'impatient'] as const;
export type Pool = (typeof POOLS)[number];

export interface Variant {
  /** Stable ID, never reuse or renumber: recorded audio files are named after it. */
  id: string;
  guest: string;
  guestEn: string;
  /** The ONE correct reply to this exact guest line. */
  reply: string;
  replyEn: string;
  /** Extra wrong options that only make sense for this line (e.g. "You're welcome" after "Finally"). */
  wrong?: WrongReply[];
}

export interface WrongReply {
  id: string;
  text: string;
  en: string;
  /** One English sentence: why this is wrong. */
  why: string;
}

export const NODES = [
  'door', 'hello', 'askDrink', 'drinkOrder', 'drinkThanks', 'orderDirect', 'askRec', 'acceptRec',
  'allergyNone', 'allergyYes', 'allergyConflict', 'conflictAccept', 'checkin', 'check', 'pay',
] as const;
export type NodeName = (typeof NODES)[number];

export const TOKENS = ['drink', 'otherDrink', 'drinkList', 'dishes', 'rec', 'safe', 'conflict', 'allergy', 'allergyNoun'] as const;
export type TokenName = (typeof TOKENS)[number];

/** A filled-in token: the target-language text, the English text, and a key used in audio file names. */
export interface TokenValue {
  text: string;
  en: string;
  key: string;
}
export type TokenContext = Partial<Record<TokenName, TokenValue>>;
