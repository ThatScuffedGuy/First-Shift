import { settings, updateSettings } from '../settings';
import { createPanel, el } from './dom';
import type { Panels } from './panels';
import { THEME_CHOICES, type Theme } from './theme';

/** Settings, reachable from the start screen and the top bar. Opening it pauses the game. */
export class SettingsPanel {
  private overlay: HTMLElement;
  private pad: HTMLElement;
  private statusEl: HTMLElement;

  constructor(private panels: Panels, private theme: Theme, private testSound: (report: (text: string, ok: boolean) => void) => void) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    this.pad = pad;
    pad.append(
      el(`<div class="scroll">
        <h2 id="${titleId}">Settings</h2>
        <p class="field">Sound</p>
        <label class="check"><input type="checkbox" data-k="voice"> Read lines aloud</label>
        <label class="slider"><span>Voice volume</span><input type="range" min="0" max="1" step="0.05" data-k="voiceVolume"></label>
        <label class="check"><input type="checkbox" data-k="sfx"> Sound effects</label>
        <label class="slider"><span>Effects volume</span><input type="range" min="0" max="1" step="0.05" data-k="sfxVolume"></label>
        <div class="row" style="margin-top:8px"><button class="ghost" type="button" data-test>Test sound</button></div>
        <p class="status" data-status aria-live="polite"></p>
        <p class="field">Learning</p>
        <label class="check"><input type="checkbox" data-k="slow"> Guests speak slowly</label>
        <label class="check"><input type="checkbox" data-k="showEnglish"> Show English under what guests say</label>
        <label class="check"><input type="checkbox" data-k="tutorial"> Guide me through the first guest of each shift</label>
        <p class="field" id="themeLabel">Colours</p>
        <div class="chips" role="group" aria-labelledby="themeLabel" data-theme>${THEME_CHOICES.map((c) => `<button class="chip" type="button" data-v="${c.value}">${c.label}</button>`).join('')}</div>
      </div>`),
      el('<div class="foot"><span></span><button class="ink" type="button" data-close>Done</button></div>'),
    );
    this.statusEl = pad.querySelector('[data-status]')!;
    pad.addEventListener('change', (e) => {
      const input = e.target as HTMLInputElement;
      const k = input.dataset.k as keyof typeof settings | undefined;
      if (!k) return;
      updateSettings({ [k]: input.type === 'checkbox' ? input.checked : Number(input.value) });
    });
    pad.addEventListener('input', (e) => {
      const input = e.target as HTMLInputElement;
      if (input.type === 'range' && input.dataset.k) updateSettings({ [input.dataset.k]: Number(input.value) });
    });
    pad.querySelector('[data-theme]')!.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-v]');
      if (b) {
        this.theme.set(b.dataset.v as never);
        this.sync();
      }
    });
    pad.querySelector('[data-test]')!.addEventListener('click', () =>
      this.testSound((text, ok) => {
        this.statusEl.textContent = text;
        this.statusEl.classList.toggle('bad', !ok);
      }),
    );
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }

  private onClose: () => void = () => {};

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(onClose: () => void = () => {}): void {
    this.onClose = onClose;
    this.sync();
    this.statusEl.textContent = '';
    this.panels.show(this.overlay);
  }

  close(): void {
    this.panels.hide(this.overlay);
    this.onClose();
  }

  private sync(): void {
    this.pad.querySelectorAll<HTMLInputElement>('input[data-k]').forEach((i) => {
      const v = settings[i.dataset.k as keyof typeof settings];
      if (i.type === 'checkbox') i.checked = Boolean(v);
      else i.value = String(v);
    });
    this.pad.querySelectorAll<HTMLElement>('[data-theme] [data-v]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === this.theme.choice)));
  }
}
