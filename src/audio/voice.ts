import manifest from '../data/audio-manifest.json';
import type { Speech } from './speech';
import type { NeuralVoices } from './neural';

/**
 * Plays spoken lines in order: your recorded clip if one exists for the
 * line's ID (see the audio-script folder), otherwise the device's speech voice.
 */
export interface SpokenLine {
  text: string;
  clipId?: string;
  who: 'guest' | 'you';
  /** Different guests get different voices and pitches. */
  voiceSeed: number;
}

export interface VoiceOptions {
  /** Language code, e.g. "ru" (for downloaded voices). */
  lang: string;
  tag: string;
  /** Language name for messages, e.g. "Russian". */
  label: string;
  enabled: boolean;
  volume: number;
  slow: boolean;
}

const CLIPS: Record<string, string> = (manifest as { clips: Record<string, string> }).clips;

/** True if a recording exists for this line. */
export const hasClip = (clipId?: string) => !!clipId && clipId in CLIPS;

export class VoicePlayer {
  private generation = 0;
  private audio: HTMLAudioElement | null = null;
  private warned = false;
  private noVoiceWarned = '';

  constructor(private speech: Speech, private neural: NeuralVoices, private onProblem: (message: string) => void) {}

  stop(): void {
    this.generation++;
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.speech.cancel();
  }

  /** Stops whatever is playing and plays these lines one after another. */
  async say(lines: SpokenLine[], opts: VoiceOptions): Promise<void> {
    this.stop();
    if (!opts.enabled) return;
    const gen = this.generation;
    for (const line of lines) {
      if (gen !== this.generation) return;
      // 1. Your recording, 2. a downloaded voice, 3. the device's own voice.
      let played = hasClip(line.clipId) && (await this.playClip(`audio/${CLIPS[line.clipId!]}`, opts, gen));
      if (gen !== this.generation) return;
      if (!played && this.neural.isReady(opts.lang)) {
        try {
          const blob = await this.neural.synth(opts.lang, line.text);
          if (gen !== this.generation) return;
          const url = URL.createObjectURL(blob);
          played = await this.playClip(url, opts, gen);
          URL.revokeObjectURL(url);
        } catch {
          played = false;
        }
        if (gen !== this.generation) return;
      }
      if (!played) {
        const res = await this.speech.speak(line.text, {
          tag: opts.tag,
          voiceIndex: line.who === 'you' ? 0 : 1 + (line.voiceSeed % 7),
          pitch: line.who === 'you' ? 1 : 0.8 + ((line.voiceSeed % 100) / 100) * 0.45,
          rate: opts.slow ? 0.8 : 1,
          volume: opts.volume,
        });
        if (res === 'novoice' && this.noVoiceWarned !== opts.tag) {
          this.noVoiceWarned = opts.tag;
          this.onProblem(
            this.neural.languages.includes(opts.lang)
              ? `This device has no ${opts.label} voice. Download a free ${opts.label} voice in Settings → Voices, or add one in your system's speech settings.`
              : `This device has no ${opts.label} voice, so unrecorded lines are shown but not read aloud. You can add one in your system's speech settings.`,
          );
        }
        if (res === 'error' && !this.warned) {
          this.warned = true;
          this.onProblem(this.speech.supported ? 'A line didn’t play. Try “Test sound” in Settings.' : "This browser can't play speech, so lines are text only.");
        }
      }
    }
  }

  private playClip(src: string, opts: VoiceOptions, gen: number): Promise<boolean> {
    return new Promise((resolve) => {
      const a = new Audio(src);
      a.volume = opts.volume;
      a.playbackRate = opts.slow ? 0.85 : 1;
      a.preservesPitch = true;
      this.audio = a;
      a.onended = () => resolve(true);
      a.onerror = () => resolve(false); // missing or unreadable file: fall back to speech
      a.play().catch(() => resolve(false));
      // Safety net if the clip stalls.
      setTimeout(() => {
        if (gen === this.generation && this.audio === a && !a.ended && a.paused) resolve(false);
      }, 15000);
    });
  }
}
