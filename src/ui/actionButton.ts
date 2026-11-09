const $ = (id: string) => document.getElementById(id)!;

export interface Action {
  label: string;
  /** Smaller second line explaining the situation. */
  hint?: string;
  /** Leave out for a label that can't be pressed (just information). */
  run?: () => void;
}

/** The single context button at the bottom of the screen. E presses it too. */
export class ActionButton {
  private wrap = $('action');
  private button = $('actionBtn') as HTMLButtonElement;
  private labelEl = $('actionLabel');
  private hintEl = $('actionHint');
  private keyEl = $('actionKey');
  private current: Action | null = null;
  private key = '';

  constructor() {
    this.button.addEventListener('click', () => this.press());
  }

  /** Shows an action, or hides the button when null. Cheap to call every frame. */
  show(action: Action | null): void {
    this.current = action;
    const key = action ? `${action.label}|${action.hint ?? ''}|${action.run ? 1 : 0}` : '';
    if (key === this.key) return;
    this.key = key;
    this.wrap.hidden = !action;
    if (!action) return;
    this.labelEl.textContent = action.label;
    this.hintEl.textContent = action.hint ?? '';
    this.hintEl.hidden = !action.hint;
    this.keyEl.hidden = !action.run;
    // aria-disabled (not disabled) keeps it focusable, so screen readers can still read it.
    this.button.setAttribute('aria-disabled', String(!action.run));
  }

  press(): void {
    this.current?.run?.();
  }
}
