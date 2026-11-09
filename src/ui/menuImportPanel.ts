import type { Menu } from '../data/types';
import { api } from '../online/api';
import { progress } from '../progress';
import { createPanel, el } from './dom';
import type { Panels } from './panels';
import { renderMenu } from './stationPanels';

/** Shrinks a photo so it uploads quickly and stays under the server's size limit. */
async function photoToDataUrl(file: File, maxSide = 1600): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.85);
}

/**
 * Import a real restaurant's menu: paste the text or add a photo. The server's
 * AI turns it into game data (names in every language, prices, allergens).
 */
export class MenuImportPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private onDone: (menu: Menu | null) => void = () => {};
  private found: Menu | null = null;
  private lang = 'es';

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(el(`<div class="scroll"><h2 id="${titleId}">Import a real menu</h2><div data-body></div></div>`), el('<div class="foot"><button class="ghost" type="button" data-close>Back</button><button class="ink" type="button" data-use hidden>Use this menu</button></div>'));
    this.body = pad.querySelector('[data-body]')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.finish(null));
    pad.querySelector('[data-use]')!.addEventListener('click', () => {
      if (!this.found) return;
      progress.addMenu(this.found);
      this.finish(this.found);
    });
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.finish(null));
    this.body.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('[data-read]')) void this.read();
    });
  }

  open(lang: string, onDone: (menu: Menu | null) => void): void {
    this.onDone = onDone;
    this.lang = lang;
    this.found = null;
    this.overlay.querySelector<HTMLElement>('[data-use]')!.hidden = true;
    if (!api.available || !api.signedIn) {
      this.body.innerHTML = `<p>${api.available ? 'Sign in first (Main menu → Your account). Importing uses a free online AI, so it’s limited to signed-in players, 10 menus a day.' : 'Menu import works in the online version of First Shift, opened from its website.'}</p>`;
    } else {
      this.body.innerHTML = `
        <p>Paste the menu from a restaurant’s website, or add a photo of a printed menu. An AI reads it once and names every dish in each language the game teaches. The guests are still scripted.</p>
        <textarea data-text placeholder="Paste the menu here" style="width:100%;min-height:140px"></textarea>
        <div class="row" style="margin-top:8px"><label class="ghost" style="cursor:pointer">Add a photo <input type="file" accept="image/*" data-photo hidden></label><span class="status" data-photoname style="margin:0"></span></div>
        <div class="row" style="margin-top:10px"><button class="ink" type="button" data-read>Read menu</button></div>
        <p class="status" data-status role="status"></p>
        <ul class="menu-list" data-preview></ul>`;
      const photo = this.body.querySelector<HTMLInputElement>('[data-photo]')!;
      photo.addEventListener('change', () => (this.body.querySelector('[data-photoname]')!.textContent = photo.files?.[0]?.name ?? ''));
    }
    this.panels.show(this.overlay);
  }

  private status(text: string, bad = false): void {
    const s = this.body.querySelector<HTMLElement>('[data-status]')!;
    s.textContent = text;
    s.classList.toggle('bad', bad);
  }

  private async read(): Promise<void> {
    const text = this.body.querySelector<HTMLTextAreaElement>('[data-text]')!.value.trim();
    const file = this.body.querySelector<HTMLInputElement>('[data-photo]')!.files?.[0];
    if (!text && !file) return this.status('Paste the menu text or add a photo first.', true);
    const btn = this.body.querySelector<HTMLButtonElement>('[data-read]')!;
    btn.disabled = true;
    this.status('Reading the menu. This can take up to a minute…');
    try {
      const { menu } = await api.importMenu(text ? { text } : { image: await photoToDataUrl(file!) });
      this.found = menu as Menu;
      this.body.querySelector('[data-preview]')!.innerHTML = renderMenu(this.found, this.lang);
      this.status(`Found ${this.found.items.length} items in “${this.found.name}”. Allergens are best guesses from the ingredients, as a real server would double-check with the kitchen.`);
      this.overlay.querySelector<HTMLElement>('[data-use]')!.hidden = false;
    } catch (e) {
      this.status((e as Error).message, true);
    } finally {
      btn.disabled = false;
    }
  }

  private finish(menu: Menu | null): void {
    this.panels.hide(this.overlay);
    this.onDone(menu);
  }
}

