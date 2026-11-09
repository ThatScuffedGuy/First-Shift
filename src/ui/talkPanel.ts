import type { LogEntry } from '../game/guest';
import type { Option } from '../dialogue/conversation';
import { createPanel, el, esc } from './dom';
import type { Panels } from './panels';

export interface TalkView {
  title: string;
  /** e.g. "Tourist · looks happy" */
  subtitle: string;
  log: LogEntry[];
  /** Options for the current turn, or null when the conversation is over. */
  options: Option[] | null;
  /** Button shown when the conversation is over, e.g. "Lead the guest to a table". */
  nextLabel: string | null;
  langCode: string;
  showEnglish: boolean;
  /** Which lines have a recording (shown with a different speaker icon). */
  hasRecording: (clipId?: string) => boolean;
}

export interface TalkHandlers {
  choose(i: number): void;
  stepAway(): void;
  next(): void;
  play(logIndex: number): void;
  reveal(logIndex: number): void;
}

/** The conversation panel: the guest's lines, your replies, coaching notes and three options. */
export class TalkPanel {
  private overlay: HTMLElement;
  private titleEl: HTMLElement;
  private subEl: HTMLElement;
  private logEl: HTMLElement;
  private optsEl: HTMLElement;
  private nextBtn: HTMLButtonElement;
  private view: TalkView | null = null;

  constructor(private panels: Panels, private h: TalkHandlers) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<div class="talk-head"><h2 id="${titleId}"></h2><span class="mood"></span></div>`),
      el('<div class="log scroll" aria-live="polite"></div>'),
      el('<div class="options"></div>'),
      el('<div class="foot"><button class="ghost" type="button" data-step>Step away</button><button class="ink" type="button" data-next hidden></button></div>'),
    );
    this.titleEl = pad.querySelector('h2')!;
    this.subEl = pad.querySelector('.mood')!;
    this.logEl = pad.querySelector('.log')!;
    this.optsEl = pad.querySelector('.options')!;
    this.nextBtn = pad.querySelector('[data-next]')!;
    pad.querySelector('[data-step]')!.addEventListener('click', () => this.h.stepAway());
    this.nextBtn.addEventListener('click', () => this.h.next());
    this.optsEl.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-opt]');
      if (b && b.getAttribute('aria-disabled') !== 'true') this.h.choose(Number(b.dataset.opt));
    });
    this.logEl.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const play = t.closest<HTMLElement>('[data-play]');
      if (play) this.h.play(Number(play.dataset.play));
      const reveal = t.closest<HTMLElement>('[data-reveal]');
      if (reveal) this.h.reveal(Number(reveal.dataset.reveal));
    });
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.h.stepAway();
      }
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && this.view?.options && !(e.target as HTMLElement).closest('input')) {
        const opt = this.view.options[n - 1];
        if (opt && !opt.tried) this.h.choose(n - 1);
      }
    });
  }

  get isOpen(): boolean {
    return !this.overlay.hidden;
  }

  open(view: TalkView): void {
    this.render(view);
    this.panels.show(this.overlay, this.optsEl.querySelector<HTMLElement>('[data-opt]') ?? this.nextBtn);
  }

  close(): void {
    this.view = null;
    this.panels.hide(this.overlay);
  }

  render(view: TalkView): void {
    const hadFocusInOptions = this.optsEl.contains(document.activeElement);
    this.view = view;
    this.titleEl.textContent = view.title;
    this.subEl.textContent = view.subtitle;
    const lang = esc(view.langCode);
    this.logEl.innerHTML = view.log
      .map((e, i) => {
        if (e.who === 'coach') return `<div class="coach${e.ok ? ' ok' : ''}"><span class="mark" aria-hidden="true">${e.ok ? '✓' : '✗'}</span><span class="sr-only">${e.ok ? 'Correct. ' : 'Not quite. '}</span>${esc(e.note)}</div>`;
        const icon = view.hasRecording(e.clipId) ? '🎙️' : '🔊';
        const play = `<button class="play" type="button" data-play="${i}" aria-label="Play this line again">${icon}</button>`;
        if (e.who === 'you') return `<div class="line you"><div class="who">${play}You</div><div class="said" lang="${lang}">${esc(e.text)}</div><div class="tr">${esc(e.en)}</div></div>`;
        const tr = view.showEnglish || e.revealed ? `<div class="tr">${esc(e.en)}</div>` : `<button class="reveal" type="button" data-reveal="${i}">Show English</button>`;
        return `<div class="line guest"><div class="who">Guest${play}</div><div class="said" lang="${lang}">${esc(e.text)}</div>${tr}</div>`;
      })
      .join('');
    this.logEl.scrollTop = this.logEl.scrollHeight;

    if (view.options) {
      this.nextBtn.hidden = true;
      this.optsEl.innerHTML =
        '<p class="field">What do you say? <span class="sr-only">Press 1, 2 or 3.</span></p>' +
        view.options
          .map((o, i) => `<button class="opt" type="button" data-opt="${i}" lang="${lang}" aria-disabled="${o.tried}"><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(o.text)}</span></button>`)
          .join('');
      if (hadFocusInOptions || !this.optsEl.contains(document.activeElement)) {
        this.optsEl.querySelector<HTMLElement>('[data-opt][aria-disabled="false"]')?.focus();
      }
    } else {
      this.optsEl.replaceChildren();
      this.nextBtn.hidden = !view.nextLabel;
      this.nextBtn.textContent = view.nextLabel ?? '';
      if (view.nextLabel) this.nextBtn.focus();
    }
  }
}
