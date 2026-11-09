import { LANGUAGES, languageByCode } from '../data/languages';
import { HOUSE_MENU } from '../data/menus';
import { settings, updateSettings } from '../settings';
import { createPanel, el, esc } from './dom';
import type { Panels } from './panels';
import { renderMenu } from './stationPanels';

export interface StartHandlers {
  start(): void;
  testSound(report: (text: string, ok: boolean) => void): void;
  voiceStatus(): { text: string; ok: boolean };
  openSettings(): void;
}

/** The first screen: pick a language and speed, test the sound, start the shift. */
export class StartScreen {
  private overlay: HTMLElement;
  private pad: HTMLElement;
  private statusEl: HTMLElement;

  constructor(private panels: Panels, private h: StartHandlers) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    this.pad = pad;
    pad.append(
      el(`<div class="scroll">
        <h1 id="${titleId}">First Shift</h1>
        <p class="lead">Work a dinner shift in another language. Seat guests at the door, take drink orders, run drinks and food, and handle allergies, spills and difficult guests.</p>
        <p class="field" id="langLabel">Language guests speak</p>
        <div class="chips" role="group" aria-labelledby="langLabel" data-langs>${LANGUAGES.map((l) => `<button class="chip" type="button" data-lang="${esc(l.code)}">${esc(l.label)}</button>`).join('')}</div>
        <p class="field" id="speedLabel">How guests talk</p>
        <div class="chips" role="group" aria-labelledby="speedLabel" data-speed>
          <button class="chip" type="button" data-slow="1">Slowly</button>
          <button class="chip" type="button" data-slow="0">Natural speed</button>
        </div>
        <label class="check"><input type="checkbox" data-english> Show English under what guests say</label>
        <label class="check"><input type="checkbox" data-tutorial> Guide me through the first guest</label>
        <div class="row" style="margin-top:10px"><button class="ghost" type="button" data-test>Test sound</button><button class="ghost" type="button" data-settings>Settings</button></div>
        <p class="status" data-status aria-live="polite"></p>
        <details style="margin-top:10px"><summary class="field" style="cursor:pointer">Tonight’s menu</summary><ul class="menu-list" data-menu></ul></details>
        <p class="field">Controls</p>
        <ul class="controls">
          <li>Move with <kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd>, the arrow keys, or by tapping the floor.</li>
          <li>Press <kbd>E</kbd> or the button at the bottom to act. In conversations, press <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> to answer.</li>
          <li>The clock runs 5 times faster than real life, and pauses while a panel is open.</li>
        </ul>
      </div>`),
      el('<div class="foot"><span></span><button class="ink" type="button" data-start>Start shift</button></div>'),
    );
    this.statusEl = pad.querySelector('[data-status]')!;
    const q = <T extends HTMLElement>(s: string) => pad.querySelector<T>(s)!;

    q('[data-langs]').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]');
      if (b) {
        updateSettings({ lang: b.dataset.lang! });
        this.sync();
      }
    });
    q('[data-speed]').addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-slow]');
      if (b) {
        updateSettings({ slow: b.dataset.slow === '1' });
        this.sync();
      }
    });
    q<HTMLInputElement>('[data-english]').addEventListener('change', (e) => updateSettings({ showEnglish: (e.target as HTMLInputElement).checked }));
    q<HTMLInputElement>('[data-tutorial]').addEventListener('change', (e) => updateSettings({ tutorial: (e.target as HTMLInputElement).checked }));
    q('[data-test]').addEventListener('click', () => this.h.testSound((text, ok) => this.setStatus(text, ok)));
    q('[data-settings]').addEventListener('click', () => this.h.openSettings());
    q('[data-start]').addEventListener('click', () => this.h.start());
  }

  open(): void {
    this.sync();
    this.panels.show(this.overlay, this.pad.querySelector<HTMLElement>('[data-start]')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }

  /** Refreshes the controls from settings (also called when voices finish loading). */
  sync(): void {
    const pad = this.pad;
    pad.querySelectorAll<HTMLElement>('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === settings.lang)));
    pad.querySelectorAll<HTMLElement>('[data-slow]').forEach((b) => b.setAttribute('aria-pressed', String((b.dataset.slow === '1') === settings.slow)));
    pad.querySelector<HTMLInputElement>('[data-english]')!.checked = settings.showEnglish;
    pad.querySelector<HTMLInputElement>('[data-tutorial]')!.checked = settings.tutorial;
    pad.querySelector('[data-menu]')!.innerHTML = renderMenu(HOUSE_MENU, languageByCode(settings.lang).code);
    const s = this.h.voiceStatus();
    this.setStatus(s.text, s.ok);
  }

  private setStatus(text: string, ok: boolean): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('bad', !ok);
  }
}
