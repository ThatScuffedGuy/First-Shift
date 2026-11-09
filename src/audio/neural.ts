import { NEURAL_VOICES } from '../data/neuralVoices';

/**
 * Downloadable neural voices that run inside the browser (Piper TTS).
 * The library is only loaded when first needed. Voices are stored in the
 * browser's private storage, so the download happens once per device.
 */
type Piper = typeof import('@mintplex-labs/piper-tts-web');

let lib: Promise<Piper> | null = null;
const load = () => (lib ??= import('@mintplex-labs/piper-tts-web'));

export class NeuralVoices {
  private ready = new Set<string>();
  private busy = new Map<string, Promise<void>>();
  private listeners: (() => void)[] = [];

  /** Which languages have a voice to offer. */
  get languages(): string[] {
    return Object.keys(NEURAL_VOICES);
  }

  sizeMb(lang: string): number {
    return NEURAL_VOICES[lang]?.sizeMb ?? 0;
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn);
  }

  private changed(): void {
    for (const fn of this.listeners) fn();
  }

  /** Checks which voices are already downloaded on this device. */
  async refresh(): Promise<void> {
    if (!('storage' in navigator) || !navigator.storage?.getDirectory) return;
    try {
      const stored = await (await load()).stored();
      for (const [lang, v] of Object.entries(NEURAL_VOICES)) if (stored.includes(v.voiceId)) this.ready.add(lang);
      this.changed();
    } catch {
      // Storage unavailable (e.g. private window): voices just can't be kept.
    }
  }

  isReady(lang: string): boolean {
    return this.ready.has(lang);
  }

  isDownloading(lang: string): boolean {
    return this.busy.has(lang);
  }

  /** Downloads a language's voice. `progress` gets 0..1. Throws with a readable message on failure. */
  download(lang: string, progress: (fraction: number) => void): Promise<void> {
    const v = NEURAL_VOICES[lang];
    if (!v) return Promise.reject(new Error('No downloadable voice for this language yet.'));
    const existing = this.busy.get(lang);
    if (existing) return existing;
    const job = (async () => {
      try {
        const piper = await load();
        await piper.download(v.voiceId, (p) => p.total && progress(p.loaded / p.total));
        this.ready.add(lang);
      } catch (e) {
        throw new Error(`The voice didn't download (${(e as Error)?.message || 'network error'}). Check your internet connection and try again.`);
      } finally {
        this.busy.delete(lang);
        this.changed();
      }
    })();
    this.busy.set(lang, job);
    this.changed();
    return job;
  }

  async remove(lang: string): Promise<void> {
    const v = NEURAL_VOICES[lang];
    if (!v) return;
    await (await load()).remove(v.voiceId);
    this.ready.delete(lang);
    this.changed();
  }

  /** Turns text into speech audio. Only call when isReady(lang). */
  async synth(lang: string, text: string): Promise<Blob> {
    return (await load()).predict({ text, voiceId: NEURAL_VOICES[lang].voiceId });
  }
}
