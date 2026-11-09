export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'first-shift.theme';
const ORDER: ThemeChoice[] = ['auto', 'light', 'dark'];
const NAMES: Record<ThemeChoice, string> = { auto: 'Auto', light: 'Light', dark: 'Dark' };

/**
 * Light/dark mode. "Auto" follows the device. The choice is remembered on this
 * device when the browser allows it (private windows may not).
 */
export class Theme {
  private choice: ThemeChoice = 'auto';
  private listeners: (() => void)[] = [];
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor(private button: HTMLButtonElement) {
    try {
      const saved = localStorage.getItem(KEY) as ThemeChoice | null;
      if (saved && ORDER.includes(saved)) this.choice = saved;
    } catch {
      // Storage is blocked (e.g. a private window): stay on auto.
    }
    button.addEventListener('click', () => this.set(ORDER[(ORDER.indexOf(this.choice) + 1) % ORDER.length]));
    this.media.addEventListener('change', () => this.notify());
    this.apply();
  }

  /** Called whenever the effective theme changes. */
  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  get isDark(): boolean {
    return this.choice === 'dark' || (this.choice === 'auto' && this.media.matches);
  }

  private set(choice: ThemeChoice): void {
    this.choice = choice;
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Not saved; it still applies for this visit.
    }
    this.apply();
  }

  private apply(): void {
    const root = document.documentElement;
    if (this.choice === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this.choice);
    this.button.textContent = `Theme: ${NAMES[this.choice]}`;
    this.button.setAttribute('aria-label', `Colour theme: ${NAMES[this.choice]}. Press to change.`);
    this.notify();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}
