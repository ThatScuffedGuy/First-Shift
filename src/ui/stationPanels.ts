import { ALLERGENS, type Allergen, type Menu, type MenuItem } from '../data/types';
import { createPanel, el, esc, money } from './dom';
import type { Panels } from './panels';

/** Target-language name in handwriting, English below. */
const itemLabel = (m: MenuItem, lang: string) =>
  `<span><b lang="${esc(lang)}">${esc(m.names[lang]?.plain ?? m.names.en.plain)}</b><small>${esc(m.names.en.plain)}</small></span>`;

/**
 * The drink station: pick the table, tick every drink they ordered (from
 * memory: one per person), then pour. A single guest's drink pours in one tap.
 */
export class BarPanel {
  private overlay: HTMLElement;
  private tablesEl: HTMLElement;
  private drinksEl: HTMLElement;
  private hintEl: HTMLElement;
  private pourBtn: HTMLButtonElement;
  private waiting: { guestId: number; table: number; size: number; missing: number }[] = [];
  private chosen = 0;
  private onPour: (guestId: number, drinkIds: string[]) => void = () => {};

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<h2 id="${titleId}">Drink station</h2>`),
      el('<div class="scroll"><p class="field">Which table?</p><div class="chips" data-tables></div><p class="field">What did they order?</p><p class="status" data-hint></p><div class="items" data-drinks></div></div>'),
      el('<div class="foot"><button class="ghost" type="button" data-close>Back to the floor</button><button class="ink" type="button" data-pour disabled>Pour</button></div>'),
    );
    this.tablesEl = pad.querySelector('[data-tables]')!;
    this.drinksEl = pad.querySelector('[data-drinks]')!;
    this.hintEl = pad.querySelector('[data-hint]')!;
    this.pourBtn = pad.querySelector('[data-pour]')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    this.tablesEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-g]');
      if (!b) return;
      this.chosen = Number(b.dataset.g);
      this.tablesEl.querySelectorAll('[data-g]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      this.syncHint();
    });
    this.drinksEl.addEventListener('change', () => {
      // On your own, ticking a drink pours it straight away.
      if (this.current.missing === 1 && this.picked().length === 1) return this.pour();
      this.pourBtn.disabled = this.picked().length === 0;
    });
    this.pourBtn.addEventListener('click', () => this.pour());
  }

  private get current() {
    return this.waiting.find((w) => w.guestId === this.chosen) ?? this.waiting[0];
  }

  private picked(): string[] {
    return [...this.drinksEl.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
  }

  private syncHint(): void {
    const n = this.current.missing;
    const t = this.current.table;
    this.hintEl.textContent =
      this.current.size === 1 ? `Tick the drink Table ${t} ordered.` : n < this.current.size ? `Table ${t} still needs ${n} drink${n > 1 ? 's' : ''}: tick ${n > 1 ? 'them' : 'it'}, then pour.` : `Table ${t} is a group of ${n}: tick all ${n} drinks, then pour.`;
    this.pourBtn.textContent = n > 1 ? `Pour ${n} drinks` : 'Pour';
  }

  private pour(): void {
    const ids = this.picked();
    if (!ids.length) return;
    this.close();
    this.onPour(this.current.guestId, ids);
  }

  open(waiting: { guestId: number; table: number; size: number; missing: number }[], menu: Menu, lang: string, onPour: (guestId: number, drinkIds: string[]) => void): void {
    this.onPour = onPour;
    this.waiting = waiting;
    this.chosen = waiting[0].guestId;
    this.tablesEl.innerHTML = waiting.map((w, i) => `<button class="chip" type="button" data-g="${w.guestId}" aria-pressed="${i === 0}">Table ${w.table}${w.size > 1 ? ` (${w.size})` : ''}</button>`).join('');
    this.drinksEl.innerHTML = menu.items
      .filter((m) => m.category === 'drink')
      .map((d) => `<label class="item"><input type="checkbox" value="${esc(d.id)}"><span class="swatch" style="background:${esc(d.color)}"></span>${itemLabel(d, lang)}</label>`)
      .join('');
    this.pourBtn.disabled = true;
    this.syncHint();
    this.panels.show(this.overlay, this.drinksEl.querySelector<HTMLElement>('input')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }
}

/** The ticket: pick the dishes they ordered and flag allergies for the kitchen (from memory). */
export class TicketPanel {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private itemsEl: HTMLElement;
  private flagsEl: HTMLElement;
  private sendBtn: HTMLButtonElement;
  private onSend: (dishIds: string[], flags: Allergen[]) => void = () => {};

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<h2 id="${titleId}">Ticket</h2>`),
      el('<div class="scroll"><p class="field">What did they order?</p><div class="items" data-items></div><p class="field">Allergies to flag for the kitchen</p><div class="chips" data-flags></div></div>'),
      el('<div class="foot"><button class="ghost" type="button" data-close>Back to the floor</button><button class="ink" type="button" data-send disabled>Send to kitchen</button></div>'),
    );
    this.titleEl = pad.querySelector('h2')!;
    this.itemsEl = pad.querySelector('[data-items]')!;
    this.flagsEl = pad.querySelector('[data-flags]')!;
    this.sendBtn = pad.querySelector('[data-send]')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
    this.itemsEl.addEventListener('change', () => (this.sendBtn.disabled = !this.itemsEl.querySelector('input:checked')));
    this.flagsEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-a]');
      if (b) b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
    this.sendBtn.addEventListener('click', () => {
      const dishIds = [...this.itemsEl.querySelectorAll<HTMLInputElement>('input:checked')].map((i) => i.value);
      const flags = [...this.flagsEl.querySelectorAll<HTMLElement>('[aria-pressed="true"]')].map((b) => b.dataset.a as Allergen);
      if (!dishIds.length) return;
      this.close();
      this.onSend(dishIds, flags);
    });
  }

  open(table: number, menu: Menu, lang: string, showAllergens: boolean, onSend: (dishIds: string[], flags: Allergen[]) => void): void {
    this.onSend = onSend;
    this.titleEl.textContent = `Ticket for Table ${table}`;
    this.itemsEl.innerHTML = menu.items
      .filter((m) => m.category !== 'drink')
      .map((m) => `<label class="item"><input type="checkbox" value="${esc(m.id)}">${showAllergens ? itemLabel(m, lang).replace('</small>', ` · ${esc(m.allergens.join(', ') || 'no listed allergens')}</small>`) : itemLabel(m, lang)}</label>`)
      .join('');
    this.flagsEl.innerHTML = ALLERGENS.map((a) => `<button class="chip" type="button" data-a="${a}" aria-pressed="false">${a}</button>`).join('');
    this.sendBtn.disabled = true;
    this.panels.show(this.overlay, this.itemsEl.querySelector('input')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }
}

/** Tonight's menu: names in the guests' language, prices and allergens. */
export class MenuPanel {
  private overlay: HTMLElement;
  private list: HTMLElement;

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<h2 id="${titleId}">Tonight’s menu</h2>`),
      el('<div class="scroll"><ul class="menu-list"></ul></div>'),
      el('<div class="foot"><span></span><button class="ink" type="button" data-close>Back to the floor</button></div>'),
    );
    this.list = pad.querySelector('.menu-list')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }

  open(menu: Menu, lang: string): void {
    this.list.innerHTML = renderMenu(menu, lang);
    this.panels.show(this.overlay);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }
}

const CATEGORY_NAMES = { starter: 'Starters', main: 'Mains', dessert: 'Desserts', drink: 'Drinks' } as const;

export function renderMenu(menu: Menu, lang: string): string {
  return (Object.keys(CATEGORY_NAMES) as (keyof typeof CATEGORY_NAMES)[])
    .map((cat) => {
      const items = menu.items.filter((m) => m.category === cat);
      if (!items.length) return '';
      return (
        `<li class="cat">${CATEGORY_NAMES[cat]}</li>` +
        items
          .map(
            (m) => `<li><span class="name" lang="${esc(lang)}">${esc(m.names[lang]?.plain ?? m.names.en.plain)}</span> <span class="desc">${esc(m.names.en.plain)} · ${money(m.price)}</span>
            <span class="tags">${m.allergens.map((a) => `<span class="tag">${esc(a)}</span>`).join('')}</span><div class="desc">${esc(m.description)}</div></li>`,
          )
          .join('')
      );
    })
    .join('');
}
