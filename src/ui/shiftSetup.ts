import { LANGUAGES, languageByCode } from '../data/languages';
import { HOUSE_MENU } from '../data/menus';
import { DIFFICULTIES, SHIFT_LENGTHS, difficultyById } from '../data/difficulty';
import { settings, updateSettings } from '../settings';
import { createPanel, el, esc } from './dom';
import type { Panels } from './panels';
import { renderMenu } from './stationPanels';

export interface SetupHandlers {
  start(): void;
  back(): void;
  testSound(report: (text: string, ok: boolean) => void): void;
  voiceStatus(): { text: string; ok: boolean };
}

/** Before a shift: language, difficulty, length, speech speed, translations, sound check. */
export class ShiftSetup {
  private overlay: HTMLElement;
  private pad: HTMLElement;
  private statusEl: HTMLElement;

  constructor(private panels: Panels, private h: SetupHandlers) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    this.pad = pad;
    const chips = (key: string, items: { value: string; label: string }[]) =>
      items.map((i) => `<button class="chip" type="button" data-${key}="${esc(i.value)}">${esc(i.label)}</button>`).join('');
    pad.append(
      el(`<div class="scroll">
        <h2 id="${titleId}">Set up your shift</h2>
        <p class="field" id="langLabel">Language guests speak</p>
        <div class="chips" role="group" aria-labelledby="langLabel" data-group="lang">${chips('lang', LANGUAGES.map((l) => ({ value: l.code, label: l.label })))}</div>
        <p class="field" id="diffLabel">Difficulty</p>
        <div class="chips" role="group" aria-labelledby="diffLabel" data-group="difficulty">${chips('difficulty', DIFFICULTIES.map((d) => ({ value: d.id, label: d.label })))}</div>
        <p class="status" data-diffdesc></p>
        <p class="field" id="lenLabel">Shift length</p>
        <div class="chips" role="group" aria-labelledby="lenLabel" data-group="length">${chips('length', SHIFT_LENGTHS.map((l) => ({ value: l.id, label: l.label })))}</div>
        <p class="field" id="speedLabel">How guests talk</p>
        <div class="chips" role="group" aria-labelledby="speedLabel" data-group="slow">${chips('slow', [{ value: '1', label: 'Slowly' }, { value: '0', label: 'Natural speed' }])}</div>
        <label class="check"><input type="checkbox" data-k="groups"> Groups of 2 to 4 guests can come in</label>
        <label class="check"><input type="checkbox" data-k="showEnglish"> Show English under what guests say</label>
        <label class="check"><input type="checkbox" data-k="tutorial"> Guide me through the first guest</label>
        <div class="row" style="margin-top:10px"><button class="ghost" type="button" data-test>Test sound</button></div>
        <p class="status" data-status aria-live="polite"></p>
        <details style="margin-top:10px"><summary class="field" style="cursor:pointer">Tonight’s menu</summary><ul class="menu-list" data-menu></ul></details>
      </div>`),
      el('<div class="foot"><button class="ghost" type="button" data-back>Main menu</button><button class="ink" type="button" data-start>Start shift</button></div>'),
    );
    this.statusEl = pad.querySelector('[data-status]')!;
    pad.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('.chip');
      const group = b?.closest<HTMLElement>('[data-group]')?.dataset.group;
      if (!b || !group) return;
      const value = b.dataset[group]!;
      // HTML lowercases data-attribute names, so the length group is called "length" here.
      if (group === 'slow') updateSettings({ slow: value === '1' });
      else if (group === 'length') updateSettings({ shiftLength: value });
      else updateSettings({ [group]: value });
      this.sync();
    });
    pad.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.dataset.k) updateSettings({ [input.dataset.k]: input.checked });
    });
    pad.querySelector('[data-test]')!.addEventListener('click', () => this.h.testSound((t, ok) => this.setStatus(t, ok)));
    pad.querySelector('[data-back]')!.addEventListener('click', () => this.h.back());
    pad.querySelector('[data-start]')!.addEventListener('click', () => this.h.start());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.h.back());
  }

  open(): void {
    this.sync();
    this.panels.show(this.overlay, this.pad.querySelector<HTMLElement>('[data-start]')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  /** Refreshes the controls from settings (also called when voices finish loading). */
  sync(): void {
    const pad = this.pad;
    const pressed = (group: string, current: string) =>
      pad.querySelectorAll<HTMLElement>(`[data-group="${group}"] .chip`).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[group] === current)));
    pressed('lang', settings.lang);
    pressed('difficulty', settings.difficulty);
    pressed('length', settings.shiftLength);
    pressed('slow', settings.slow ? '1' : '0');
    pad.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) => (i.checked = Boolean(settings[i.dataset.k as 'groups'])));
    pad.querySelector('[data-diffdesc]')!.textContent = difficultyById(settings.difficulty).description;
    const pack = languageByCode(settings.lang);
    pad.querySelector('[data-start]')!.textContent = `Start shift in ${pack.label}`;
    pad.querySelector('[data-menu]')!.innerHTML = renderMenu(HOUSE_MENU, pack.code);
    const s = this.h.voiceStatus();
    this.setStatus(s.text, s.ok);
  }

  private setStatus(text: string, ok: boolean): void {
    this.statusEl.textContent = text;
    this.statusEl.classList.toggle('bad', !ok);
  }
}
