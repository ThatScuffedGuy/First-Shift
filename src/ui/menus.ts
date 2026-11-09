import { HOW_TO_PLAY } from '../data/howto';
import { createPanel, el, esc } from './dom';
import type { Panels } from './panels';

export interface MenuItem {
  id: string;
  label: string;
  /** Hidden items aren't shown (e.g. "Practice" before you've missed any phrase). */
  hidden?: boolean;
  /** Ask "are you sure?" first (the button changes text; press again to confirm). */
  confirm?: string;
  primary?: boolean;
}

/**
 * A vertical list of big buttons on an order-pad sheet: used for the main menu
 * and the pause menu.
 */
export class ChoiceMenu {
  private overlay: HTMLElement;
  private list: HTMLElement;
  private subtitle: HTMLElement;
  private armed: string | null = null;
  private items: MenuItem[] = [];

  constructor(private panels: Panels, title: string, private onChoose: (id: string) => void, opts: { big?: boolean; onEscape?: () => void } = {}) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.classList.add('menu-pad');
    pad.append(
      el(opts.big ? `<h1 id="${titleId}">${esc(title)}</h1>` : `<h2 id="${titleId}">${esc(title)}</h2>`),
      el('<p class="lead" data-sub></p>'),
      el('<div class="menu-buttons"></div>'),
    );
    this.list = pad.querySelector('.menu-buttons')!;
    this.subtitle = pad.querySelector('[data-sub]')!;
    this.list.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-id]');
      if (!b) return;
      const item = this.items.find((i) => i.id === b.dataset.id)!;
      if (item.confirm && this.armed !== item.id) {
        this.armed = item.id;
        b.textContent = item.confirm;
        return;
      }
      this.armed = null;
      this.onChoose(item.id);
    });
    if (opts.onEscape) overlay.addEventListener('keydown', (e) => e.key === 'Escape' && (e.preventDefault(), opts.onEscape!()));
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(items: MenuItem[], subtitle = ''): void {
    this.items = items;
    this.armed = null;
    this.subtitle.textContent = subtitle;
    this.subtitle.hidden = !subtitle;
    this.list.innerHTML = items
      .filter((i) => !i.hidden)
      .map((i) => `<button type="button" class="${i.primary ? 'ink' : 'ghost'}" data-id="${esc(i.id)}">${esc(i.label)}</button>`)
      .join('');
    this.panels.show(this.overlay, this.list.querySelector<HTMLElement>('button')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }
}

/** The "How to play" page. */
export class HowToPanel {
  private overlay: HTMLElement;
  private onClose: () => void = () => {};

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<div class="scroll"><h2 id="${titleId}">How to play</h2>${HOW_TO_PLAY.map((s) => `<p class="field">${esc(s.title)}</p><p>${esc(s.text)}</p>`).join('')}</div>`),
      el('<div class="foot"><span></span><button class="ink" type="button" data-close>Got it</button></div>'),
    );
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && (e.preventDefault(), this.close()));
  }

  open(onClose: () => void): void {
    this.onClose = onClose;
    this.panels.show(this.overlay);
  }

  close(): void {
    this.panels.hide(this.overlay);
    this.onClose();
  }
}
