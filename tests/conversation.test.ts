import { describe, expect, it } from 'vitest';
import { Conversation, nodesForStage, selectPool } from '../src/dialogue/conversation';
import { buildContext } from '../src/dialogue/context';
import { fill, joinList, clipId } from '../src/dialogue/fill';
import { languageByCode } from '../src/data/languages';
import { HOUSE_MENU } from '../src/data/menus';
import { seeded } from '../src/game/random';

const es = languageByCode('es');

describe('token filling', () => {
  const ctx = buildContext({ drinkId: 'lemonade', otherDrinkId: 'coffee', dishIds: ['bruschetta', 'grilled-salmon'], allergy: 'fish', conflictId: 'grilled-salmon', safeId: 'steak-frites', recId: 'grilled-salmon' }, es, HOUSE_MENU);

  it('inserts Spanish names with articles', () => {
    expect(fill('Para mí, {drink}, por favor.', ctx, 'text')).toBe('Para mí, una limonada, por favor.');
    expect(fill('Quiero {dishes}.', ctx, 'text')).toBe('Quiero la bruschetta y el salmón a la parrilla.');
    expect(fill('Tengo alergia {allergy}.', ctx, 'text')).toBe('Tengo alergia al pescado.');
  });
  it('capitalises tokens at the start of a sentence', () => {
    expect(fill('{Drink}, por favor.', ctx, 'text')).toBe('Una limonada, por favor.');
    expect(fill('{Drink} is on the menu.', ctx, 'en')).toBe('A lemonade is on the menu.');
  });
  it('fills English translations', () => {
    expect(fill('I want {dishes}.', ctx, 'en')).toBe('I want the bruschetta and the grilled salmon.');
  });
  it('uses "e" instead of "y" before an i sound', () => {
    expect(joinList(['agua', 'infusión'], ' y ')).toBe('agua e infusión');
    expect(joinList(['agua', 'hielo'], ' y ')).toBe('agua y hielo');
  });
  it('gives each filled line a stable recording ID', () => {
    expect(clipId(es, 'drinkOrder.polite.1', 'guest', 'Para mí, {drink}', ctx)).toBe('es/drinkOrder.polite.1.guest~drink-lemonade');
    expect(clipId(es, 'door.polite.1', 'reply', 'Sígame', ctx)).toBe('es/door.polite.1.reply');
  });
});

describe('conversation flow', () => {
  it('orders the food conversation by plan', () => {
    expect(nodesForStage('order', { recommend: true, allergy: true, conflict: true })).toEqual(['drinkThanks', 'askRec', 'acceptRec', 'allergyConflict', 'conflictAccept']);
    expect(nodesForStage('order', { recommend: false, allergy: false, conflict: false })).toEqual(['drinkThanks', 'orderDirect', 'allergyNone']);
  });

  it('uses impatient lines when mood is low, persona lines otherwise', () => {
    expect(selectPool(es.nodes.door, 'warm', 2)).toBe('impatient');
    expect(selectPool(es.nodes.door, 'rude', 3)).toBe('rude');
    expect(selectPool(es.nodes.askRec, 'rushed', 3)).toBe('polite');
  });

  it('offers 1 right and 2 wrong options; wrong picks are crossed out and the turn stays', () => {
    const ctx = buildContext({ drinkId: 'coffee', otherDrinkId: 'lemonade', dishIds: ['steak-frites'], allergy: null }, es, HOUSE_MENU);
    const c = new Conversation({ stage: 'greet', nodes: nodesForStage('greet', { recommend: false, allergy: false, conflict: false }), pack: es, rng: seeded(1), context: () => ctx, pool: () => 'polite' });
    const turn = c.turn!;
    expect(turn.options).toHaveLength(3);
    expect(turn.options.filter((o) => o.correct)).toHaveLength(1);
    const wrongIndex = turn.options.findIndex((o) => !o.correct);
    const res = c.choose(wrongIndex);
    expect(res.kind).toBe('wrong');
    expect(c.turn).toBe(turn);
    expect(c.choose(wrongIndex).kind).toBe('ignored');
    const right = c.choose(turn.options.findIndex((o) => o.correct));
    expect(right.kind === 'right' && !right.firstTry).toBe(true);
    // Answer the rest correctly.
    while (!c.done) c.choose(c.turn!.options.findIndex((o) => o.correct));
    expect(c.done).toBe(true);
  });
});
