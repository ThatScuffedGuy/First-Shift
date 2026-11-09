import { el } from './dom';

/**
 * The quick-reaction prompt when something goes wrong while carrying a tray.
 * Press the button or Space before the bar runs out.
 */
export class QuickReaction {
  private box: HTMLElement;
  private text: HTMLElement;
  private barEl: HTMLElement;
  private btn: HTMLButtonElement;
  private until = 0;
  private total = 1;
  private done: ((saved: boolean) => void) | null = null;

  constructor() {
    this.box = document.body.appendChild(
      el(`<div class="qte" hidden><div class="qte-card" role="alertdialog" aria-labelledby="qteText">
        <p id="qteText"></p><button class="ink" type="button">Steady the tray <kbd>Space</kbd></button>
        <div class="bar"><i></i></div></div></div>`),
    );
    this.text = this.box.querySelector('p')!;
    this.barEl = this.box.querySelector('.bar i')!;
    this.btn = this.box.querySelector('button')!;
    this.btn.addEventListener('click', () => this.finish(true));
    window.addEventListener(
      'keydown',
      (e) => {
        if (this.active && (e.code === 'Space' || e.key === ' ' || e.key === 'Enter')) {
          e.preventDefault();
          e.stopPropagation();
          this.finish(true);
        }
      },
      true,
    );
  }

  get active(): boolean {
    return this.done !== null;
  }

  start(message: string, seconds: number, done: (saved: boolean) => void): void {
    this.text.textContent = message;
    this.total = seconds * 1000;
    this.until = performance.now() + this.total;
    this.done = done;
    this.box.hidden = false;
    this.btn.focus();
  }

  /** Call every frame; ends with a spill when time runs out. */
  update(now: number): void {
    if (!this.active) return;
    const left = Math.max(0, (this.until - now) / this.total);
    this.barEl.style.width = `${left * 100}%`;
    if (left <= 0) this.finish(false);
  }

  private finish(saved: boolean): void {
    const done = this.done;
    if (!done) return;
    this.done = null;
    this.box.hidden = true;
    done(saved);
  }
}
