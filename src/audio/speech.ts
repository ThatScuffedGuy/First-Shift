/**
 * The browser's built-in text-to-speech, with the known quirks handled:
 * - Browsers block speech until the player has tapped or clicked once, so we
 *   "prime" it with a silent line on the first tap.
 * - Chrome drops speech queued right after cancel(), so we wait a moment after
 *   cancelling before speaking again.
 * - Some browsers never fire "end", so every line also has a timeout.
 * - Voices load late in Chrome; we listen for "voiceschanged".
 */
export class Speech {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
  private voices: SpeechSynthesisVoice[] = [];
  private primed = false;
  private lastCancel = 0;
  private listeners: (() => void)[] = [];
  /** The last error code the browser reported, for the Test sound message. */
  lastError = '';

  constructor() {
    if (!this.synth) return;
    const load = () => {
      try {
        this.voices = this.synth!.getVoices();
      } catch {
        this.voices = [];
      }
      for (const fn of this.listeners) fn();
    };
    load();
    this.synth.addEventListener?.('voiceschanged', load);
    document.addEventListener('pointerdown', () => this.prime(), { once: true, capture: true });
    document.addEventListener('keydown', () => this.prime(), { once: true, capture: true });
  }

  get supported(): boolean {
    return !!this.synth;
  }

  onVoicesChanged(fn: () => void): void {
    this.listeners.push(fn);
  }

  /** Voices for a language tag like "es-ES": exact region first, then any region. */
  voicesFor(tag: string): SpeechSynthesisVoice[] {
    const norm = (s: string) => s.toLowerCase().replace('_', '-');
    const want = norm(tag);
    const base = want.split('-')[0];
    const exact = this.voices.filter((v) => norm(v.lang) === want);
    const any = this.voices.filter((v) => norm(v.lang).split('-')[0] === base && !exact.includes(v));
    return [...exact, ...any];
  }

  /** A plain-language description of what the player will hear. */
  describe(tag: string, label: string): { ok: boolean; text: string } {
    if (!this.synth) return { ok: false, text: "This browser can't read lines aloud, so lines are text only unless they have a recording." };
    const n = this.voicesFor(tag).length;
    if (n) return { ok: true, text: `Lines without a recording are read by your device's ${label} voice${n > 1 ? 's' : ''}.` };
    return { ok: false, text: `No ${label} voice found on this device. Lines without a recording will be shown but not read aloud. You can add a ${label} voice in your system's language or speech settings.` };
  }

  prime(): void {
    if (this.primed || !this.synth) return;
    this.primed = true;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.synth.speak(u);
    } catch {
      // ignore
    }
  }

  private waitForVoices(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(resolve, ms);
      this.onVoicesChanged(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }

  cancel(): void {
    if (!this.synth) return;
    if (this.synth.speaking || this.synth.pending) {
      this.synth.cancel();
      this.lastCancel = performance.now();
    }
  }

  /** Speaks one line. Resolves when it ends, fails, or times out. Rejects only if speech is unavailable. */
  async speak(text: string, opts: { tag: string; voiceIndex: number; pitch: number; rate: number; volume: number; onStart?: () => void }): Promise<'ended' | 'error' | 'novoice'> {
    const synth = this.synth;
    if (!synth) return 'error';
    this.prime();
    // Chrome loads voices late; give them a moment the first time.
    if (!this.voices.length) await this.waitForVoices(1500);
    // Never read a line with another language's voice (a Russian line in a
    // Spanish voice sounds like Spanish). If the device lists voices but none
    // for this language, stay silent and let the caller explain.
    if (this.voices.length && !this.voicesFor(opts.tag).length) return 'novoice';
    const sinceCancel = performance.now() - this.lastCancel;
    if (sinceCancel < 250) await new Promise((r) => setTimeout(r, 250 - sinceCancel));
    try {
      synth.resume();
    } catch {
      // ignore
    }
    return new Promise((resolve) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = opts.tag;
      const vs = this.voicesFor(opts.tag);
      if (vs.length) u.voice = vs[opts.voiceIndex % vs.length];
      u.pitch = opts.pitch;
      u.rate = opts.rate;
      u.volume = opts.volume;
      let done = false;
      const finish = (r: 'ended' | 'error') => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        resolve(r);
      };
      u.onstart = () => opts.onStart?.();
      u.onend = () => finish('ended');
      u.onerror = (e) => {
        this.lastError = e.error;
        finish(e.error === 'interrupted' || e.error === 'canceled' ? 'ended' : 'error');
      };
      const timer = setTimeout(() => finish('ended'), 2500 + (text.length * 95) / opts.rate);
      synth.speak(u);
    });
  }
}
