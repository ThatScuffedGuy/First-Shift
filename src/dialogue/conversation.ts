import type { PersonaKind } from '../data/types';
import { type Rng, pick, shuffle } from '../game/random';
import { clipId, fill } from './fill';
import type { DialogueNode, LanguagePack, NodeName, Pool, TokenContext, Variant } from './types';

/** The five conversations of a visit. */
export type Stage = 'door' | 'greet' | 'order' | 'checkin' | 'check';

/** What shapes the food-order conversation. */
export interface OrderPlan {
  recommend: boolean;
  allergy: boolean;
  /** True when a dish they want contains their allergen and there's a safe swap. */
  conflict: boolean;
}

/** Which dialogue steps make up each conversation. */
export function nodesForStage(stage: Stage, plan: OrderPlan): NodeName[] {
  switch (stage) {
    case 'door':
      return ['door'];
    case 'greet':
      return ['hello', 'askDrink', 'drinkOrder'];
    case 'order': {
      const nodes: NodeName[] = plan.recommend ? ['drinkThanks', 'askRec', 'acceptRec'] : ['drinkThanks', 'orderDirect'];
      if (!plan.allergy) nodes.push('allergyNone');
      else if (plan.conflict) nodes.push('allergyConflict', 'conflictAccept');
      else nodes.push('allergyYes');
      return nodes;
    }
    case 'checkin':
      return ['checkin'];
    case 'check':
      return ['check', 'pay'];
  }
}

/** Mood at or below this makes guests use their "impatient" lines. */
export const IMPATIENT_MOOD = 2;

/** Impatient lines win when the guest is fed up, then the persona's own lines, then polite. */
export function selectPool(node: DialogueNode, persona: PersonaKind, mood: number): Pool {
  const has = (p: Pool) => (node.lines[p]?.length ?? 0) > 0;
  if (mood <= IMPATIENT_MOOD && has('impatient')) return 'impatient';
  if (has(persona)) return persona;
  return 'polite';
}

export interface SpokenLine {
  text: string;
  en: string;
  clipId: string;
}

export interface Option {
  text: string;
  en: string;
  correct: boolean;
  /** For wrong options: why it's wrong (English). */
  why?: string;
  /** Wrong options the player already picked get crossed out. */
  tried: boolean;
  /** Only the correct reply is ever spoken. */
  clipId?: string;
}

export interface Turn {
  node: NodeName;
  pool: Pool;
  variantId: string;
  guest: SpokenLine;
  options: Option[];
}

export type ChooseResult =
  | { kind: 'wrong'; option: Option; correct: Option }
  | { kind: 'right'; option: Option; firstTry: boolean; node: NodeName; next: Turn | null }
  | { kind: 'ignored' };

export interface ConversationSetup {
  stage: Stage;
  nodes: NodeName[];
  pack: LanguagePack;
  rng: Rng;
  /** Token values; called for every line, so changes to the order show up immediately. */
  context: () => TokenContext;
  /** Which line pool to use for a node (depends on persona and current mood). */
  pool: (node: DialogueNode) => Pool;
  /** Called just before each node's line is chosen (e.g. to swap a dish after an allergy warning). */
  beforeNode?: (node: NodeName) => void;
  /** How many wrong options to show next to the right one. */
  wrongCount?: number;
}

/** One conversation with a guest: a sequence of turns, each with shuffled options. */
export class Conversation {
  readonly stage: Stage;
  private index = 0;
  turn: Turn | null = null;

  constructor(private setup: ConversationSetup) {
    this.stage = setup.stage;
    this.turn = this.build();
  }

  get done(): boolean {
    return this.turn === null;
  }

  /** Picks option i of the current turn. */
  choose(i: number): ChooseResult {
    const turn = this.turn;
    const option = turn?.options[i];
    if (!turn || !option || option.tried) return { kind: 'ignored' };
    const correct = turn.options.find((o) => o.correct)!;
    if (!option.correct) {
      option.tried = true;
      return { kind: 'wrong', option, correct };
    }
    const firstTry = !turn.options.some((o) => o.tried);
    this.index++;
    this.turn = this.build();
    return { kind: 'right', option, firstTry, node: turn.node, next: this.turn };
  }

  private build(): Turn | null {
    const { nodes, pack, rng } = this.setup;
    if (this.index >= nodes.length) return null;
    const nodeName = nodes[this.index];
    this.setup.beforeNode?.(nodeName);
    const node = pack.nodes[nodeName];
    const pool = this.setup.pool(node);
    const variant: Variant = pick(rng, node.lines[pool] ?? node.lines.polite);
    const ctx = this.setup.context();

    const right: Option = {
      text: fill(variant.reply, ctx, 'text'),
      en: fill(variant.replyEn, ctx, 'en'),
      correct: true,
      tried: false,
      clipId: clipId(pack, variant.id, 'reply', variant.reply, ctx),
    };
    const wrongPool = shuffle(rng, [...(variant.wrong ?? []), ...node.wrong])
      .map((w) => ({ text: fill(w.text, ctx, 'text'), en: fill(w.en, ctx, 'en'), why: fill(w.why, ctx, 'en'), correct: false, tried: false }))
      .filter((w, i, all) => w.text !== right.text && all.findIndex((x) => x.text === w.text) === i);
    const options = shuffle(rng, [right, ...wrongPool.slice(0, this.setup.wrongCount ?? 2)]);

    return {
      node: nodeName,
      pool,
      variantId: variant.id,
      guest: { text: fill(variant.guest, ctx, 'text'), en: fill(variant.guestEn, ctx, 'en'), clipId: clipId(pack, variant.id, 'guest', variant.guest, ctx) },
      options,
    };
  }
}
