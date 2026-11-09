import type { Tone } from '../game/shift';
import { el } from './dom';

/** Short messages in the corner. Screen readers announce them politely. */
export class Toasts {
  private box = document.body.appendChild(el('<div class="toasts" aria-live="polite"></div>'));

  show(text: string, tone: Tone = 'info'): void {
    const t = el(`<div class="toast ${tone === 'info' ? '' : tone}"></div>`);
    t.textContent = text;
    this.box.appendChild(t);
    setTimeout(() => t.remove(), 4500);
    while (this.box.children.length > 3) this.box.firstElementChild!.remove();
  }

  clear(): void {
    this.box.replaceChildren();
  }
}
