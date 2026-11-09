export type ThemeChoice = 'auto' | 'light' | 'dark';

const KEY = 'first-shift.theme';
export const THEME_CHOICES: { value: ThemeChoice; label: string }[] = [
  { value: 'auto', label: 'Match device' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

/**
 * Light/dark mode. "Auto" follows the device. The choice is remembered on this
 * device when the browser allows it (private windows may not).
 */
export class Theme {
  private current: ThemeChoice = 'auto';
  private listeners: (() => void)[] = [];
  private media = window.matchMedia('(prefers-color-scheme: dark)');

  constructor() {
    try {
      const saved = localStorage.getItem(KEY) as ThemeChoice | null;
      if (saved && THEME_CHOICES.some((c) => c.value === saved)) this.current = saved;
    } catch {
      // Storage blocked (e.g. a private window): stay on auto.
    }
    this.media.addEventListener('change', () => this.notify());
    this.apply();
  }

  get choice(): ThemeChoice {
    return this.current;
  }

  get isDark(): boolean {
    return this.current === 'dark' || (this.current === 'auto' && this.media.matches);
  }

  /** Called whenever the effective theme changes. */
  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  set(choice: ThemeChoice): void {
    this.current = choice;
    try {
      localStorage.setItem(KEY, choice);
    } catch {
      // Not saved; it still applies for this visit.
    }
    this.apply();
  }

  private apply(): void {
    const root = document.documentElement;
    if (this.current === 'auto') root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', this.current);
    this.notify();
  }

  private notify(): void {
    for (const fn of this.listeners) fn();
  }
}
