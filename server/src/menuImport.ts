/**
 * Turning a real restaurant's menu (text or a photo) into game data with
 * Cloudflare Workers AI. The prompt asks for every dish's name in each game
 * language in the grammatical forms the dialogue needs; `normalizeMenu`
 * checks and cleans whatever comes back, so a bad answer can't break the game.
 */

export const ALLERGENS = ['gluten', 'dairy', 'eggs', 'tree nuts', 'peanuts', 'shellfish', 'fish', 'soy', 'sesame'];
const CATEGORIES = ['starter', 'main', 'dessert', 'drink'] as const;
type Category = (typeof CATEGORIES)[number];

/** Languages the game speaks, with the grammar the dialogue expects for each name form. */
export const LANGUAGE_RULES: Record<string, string> = {
  en: 'English. "order": food with "the" (the grilled salmon), drinks with "a"/"an" (a lemonade). "plain": no article, lowercase (grilled salmon).',
  es: 'Spanish (Spain). "order": food with the definite article (el salmón a la parrilla, los tacos de gambas), drinks with the indefinite article (una limonada, un café). "plain": no article.',
  ru: 'Russian. "order": accusative case as it would follow «Мне, пожалуйста, …» (лосося на гриле, газированную воду, брускетту). "plain": nominative (лосось на гриле, газированная вода).',
  fr: 'French. "order": food with the definite article (le saumon grillé, les tacos aux crevettes), drinks with the indefinite article (une limonade, un café). "plain": no article.',
};

const PALETTE: Record<Category, string[]> = {
  starter: ['#7fae4e', '#c7473a', '#e9c46a', '#a3c585'],
  main: ['#d9822b', '#e5c06b', '#f08a5d', '#8a5a3c', '#c7473a', '#d9c08a'],
  dessert: ['#4a2a1c', '#f4a3b5', '#e8d5a3'],
  drink: ['#f3e27a', '#a5622a', '#d8eef5', '#3b2414', '#f39a2b', '#c5e1a5', '#d94f6b'],
};

export const MAX_ITEMS = 20;

export function menuPrompt(menuText: string): string {
  const langs = Object.entries(LANGUAGE_RULES)
    .map(([code, rule]) => `- "${code}": ${rule}`)
    .join('\n');
  return `You turn restaurant menus into data for a waiter-training language game.
Read the menu below and return JSON: {"name": short restaurant or menu name, "items": [...]}, with up to ${MAX_ITEMS} items.
Pick a good mix: every drink you find (at least 2 if the menu has any), the starters, mains and desserts.
Each item: {"category": "starter" | "main" | "dessert" | "drink",
  "price": number (no currency sign) or null,
  "description": short English description of the main ingredients,
  "allergens": array using only: ${ALLERGENS.join(', ')} (best guess from the ingredients),
  "names": {${Object.keys(LANGUAGE_RULES).map((c) => `"${c}": {"order": ..., "plain": ...}`).join(', ')}}}
Name forms per language (translate the dish naturally; keep proper names like "Caesar"):
${langs}
Return only the JSON.

MENU:
${menuText.slice(0, 12000)}`;
}

/** JSON schema for Workers AI structured output. */
export const MENU_SCHEMA = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          category: { type: 'string', enum: [...CATEGORIES] },
          price: { type: ['number', 'null'] },
          description: { type: 'string' },
          allergens: { type: 'array', items: { type: 'string' } },
          names: {
            type: 'object',
            properties: Object.fromEntries(
              Object.keys(LANGUAGE_RULES).map((c) => [c, { type: 'object', properties: { order: { type: 'string' }, plain: { type: 'string' } }, required: ['order', 'plain'] }]),
            ),
            required: Object.keys(LANGUAGE_RULES),
          },
        },
        required: ['category', 'description', 'allergens', 'names'],
      },
    },
  },
  required: ['items'],
};

export interface MenuItemOut {
  id: string;
  category: Category;
  price: number;
  allergens: string[];
  description: string;
  names: Record<string, { order: string; plain: string }>;
  color: string;
}

export interface MenuOut {
  id: string;
  name: string;
  items: MenuItemOut[];
}

const clean = (v: unknown, max = 80) =>
  String(v ?? '')
    .replace(/[\u0000-\u001f<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);

const slug = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'item';

/**
 * Checks and cleans the AI's answer. Drops items with missing names or
 * unknown categories, keeps only known allergens, makes IDs unique, and
 * gives each item a colour. Returns a reason when the menu isn't usable.
 */
export function normalizeMenu(raw: unknown, now = Date.now()): { menu: MenuOut } | { error: string } {
  const obj = (typeof raw === 'string' ? safeParse(raw) : raw) as { name?: unknown; items?: unknown } | null;
  if (!obj || !Array.isArray(obj.items)) return { error: "The menu couldn't be read. Try pasting the text instead, or a clearer photo." };
  const used = new Set<string>();
  const counts: Record<Category, number> = { starter: 0, main: 0, dessert: 0, drink: 0 };
  const items: MenuItemOut[] = [];
  for (const it of obj.items as Record<string, unknown>[]) {
    if (items.length >= MAX_ITEMS) break;
    const category = String(it?.category ?? '').toLowerCase() as Category;
    if (!CATEGORIES.includes(category)) continue;
    const namesIn = (it.names ?? {}) as Record<string, { order?: unknown; plain?: unknown }>;
    const names: MenuItemOut['names'] = {};
    let ok = true;
    for (const code of Object.keys(LANGUAGE_RULES)) {
      const order = clean(namesIn[code]?.order);
      const plain = clean(namesIn[code]?.plain);
      if (!order || !plain || /[{}]/.test(order + plain)) ok = false;
      names[code] = { order, plain };
    }
    if (!ok) continue;
    let id = slug(names.en.plain);
    for (let n = 2; used.has(id); n++) id = `${slug(names.en.plain)}-${n}`;
    used.add(id);
    const price = Number(it.price);
    items.push({
      id,
      category,
      price: Number.isFinite(price) && price > 0 && price < 10000 ? Math.round(price * 100) / 100 : category === 'drink' ? 4 : 15,
      allergens: [...new Set((Array.isArray(it.allergens) ? it.allergens : []).map((a) => String(a).toLowerCase().trim()).filter((a) => ALLERGENS.includes(a)))],
      description: clean(it.description, 140),
      names,
      color: PALETTE[category][counts[category]++ % PALETTE[category].length],
    });
  }
  if (items.filter((i) => i.category === 'main').length < 2) return { error: 'Found fewer than 2 main dishes. Try pasting more of the menu.' };
  return { menu: { id: `imported-${now.toString(36)}`, name: clean(obj.name, 60) || 'Imported menu', items } };
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const m = s.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      return JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
}
