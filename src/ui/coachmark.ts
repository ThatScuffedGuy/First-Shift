import { el } from './dom';

/** The tutorial hint banner under the top bar. */
export class Coachmark {
  private box: HTMLElement;
  private text: HTMLElement;
  private current = '';

  constructor(onSkip: () => void) {
    this.box = document.body.appendChild(el('<div class="coachmark" role="status" hidden><b>Tip</b><span></span><button type="button">Skip tutorial</button></div>'));
    this.text = this.box.querySelector('span')!;
    this.box.querySelector('button')!.addEventListener('click', onSkip);
  }

  show(text: string | null): void {
    if (text === this.current) return;
    this.current = text ?? '';
    this.box.hidden = !text;
    this.text.textContent = text ?? '';
  }
}
