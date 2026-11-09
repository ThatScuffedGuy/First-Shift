/**
 * Small sound effects, synthesised with the Web Audio API so there are no
 * sound files to ship. Each effect is a few tones or a burst of noise.
 */
export type SfxName = 'arrive' | 'orderUp' | 'pour' | 'serve' | 'right' | 'wrong' | 'coins' | 'spill' | 'save' | 'walkout' | 'tap' | 'alert';

export class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = true;
  volume = 0.6;

  /** Browsers only allow audio after a tap; call this from a tap/click/key handler. */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SfxName): void {
    if (!this.enabled || !this.ctx || !this.master || this.volume <= 0) return;
    this.master.gain.value = this.volume * 0.5;
    const t = this.ctx.currentTime + 0.01;
    switch (name) {
      case 'arrive': // door chime: two soft bell notes
        this.tone(1318, t, 0.5, 'sine', 0.35);
        this.tone(988, t + 0.18, 0.7, 'sine', 0.35);
        break;
      case 'orderUp': // kitchen bell: bright ding with overtone
        this.tone(2093, t, 1.1, 'sine', 0.4);
        this.tone(4186, t, 0.5, 'sine', 0.12);
        break;
      case 'pour':
        this.noise(t, 0.45, 2200, 0.18, 'bandpass');
        break;
      case 'serve': // glass/plate clink
        this.tone(2637, t, 0.18, 'triangle', 0.25);
        this.tone(3520, t + 0.05, 0.15, 'triangle', 0.15);
        break;
      case 'right':
        this.tone(660, t, 0.12, 'triangle', 0.25);
        this.tone(880, t + 0.09, 0.2, 'triangle', 0.25);
        break;
      case 'wrong':
        this.tone(196, t, 0.22, 'square', 0.12);
        this.tone(165, t + 0.12, 0.28, 'square', 0.1);
        break;
      case 'coins':
        for (let i = 0; i < 4; i++) this.tone(1800 + i * 260, t + i * 0.07, 0.12, 'square', 0.08);
        break;
      case 'spill':
        this.noise(t, 0.5, 900, 0.5, 'lowpass');
        this.tone(140, t, 0.25, 'sawtooth', 0.15);
        break;
      case 'save':
        this.tone(523, t, 0.1, 'triangle', 0.2);
        this.tone(784, t + 0.08, 0.18, 'triangle', 0.2);
        break;
      case 'walkout':
        this.tone(392, t, 0.25, 'triangle', 0.2);
        this.tone(330, t + 0.2, 0.25, 'triangle', 0.2);
        this.tone(262, t + 0.4, 0.4, 'triangle', 0.2);
        break;
      case 'alert':
        this.tone(880, t, 0.1, 'square', 0.12);
        this.tone(880, t + 0.16, 0.1, 'square', 0.12);
        break;
      case 'tap':
        this.tone(1200, t, 0.04, 'sine', 0.1);
        break;
    }
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  private noise(start: number, dur: number, freq: number, gain: number, kind: BiquadFilterType): void {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = kind;
    filter.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(filter).connect(g).connect(this.master!);
    src.start(start);
  }
}
