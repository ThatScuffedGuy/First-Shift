/**
 * Player settings, remembered on this device when the browser allows it.
 * (Private windows may not; the game still works with the defaults.)
 */
export interface Settings {
  /** Language the guests speak (a language file code, e.g. "es"). */
  lang: string;
  /** Guests and the waiter speak slower. */
  slow: boolean;
  /** Show English under what guests say. When off, a "Show English" link reveals it. */
  showEnglish: boolean;
  voice: boolean;
  voiceVolume: number;
  sfx: boolean;
  sfxVolume: number;
  /** Step-by-step hints for the first guest of a shift. */
  tutorial: boolean;
}

const KEY = 'first-shift.settings';

const DEFAULTS: Settings = { lang: 'es', slow: true, showEnglish: true, voice: true, voiceVolume: 1, sfx: true, sfxVolume: 0.6, tutorial: true };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    // Storage blocked or corrupt: use defaults.
  }
  return { ...DEFAULTS };
}

const listeners: (() => void)[] = [];

export const settings: Settings = load();

export function updateSettings(change: Partial<Settings>): void {
  Object.assign(settings, change);
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    // Not saved; still applies for this visit.
  }
  for (const fn of listeners) fn();
}

export function onSettingsChange(fn: () => void): void {
  listeners.push(fn);
}
