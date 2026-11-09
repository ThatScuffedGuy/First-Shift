import { languageByCode, LANGUAGES } from '../data/languages';
import { difficultyById } from '../data/difficulty';
import { progress, type PracticeCard } from '../progress';
import { shuffle } from '../game/random';
import { createPanel, el, esc, money } from './dom';
import type { Panels } from './panels';

export interface PracticeHandlers {
  /** Read a line aloud in the card's language. */
  say(text: string, clipId: string | undefined, who: 'guest' | 'you', lang: string): void;
  sfx(name: 'right' | 'wrong'): void;
  showEnglish(): boolean;
}

/**
 * A quick drill of lines you got wrong during shifts. Get a line right on the
 * first try twice in a row (across sessions) and it counts as learned.
 */
export class PracticePanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private nextBtn: HTMLButtonElement;
  private deck: PracticeCard[] = [];
  private index = 0;
  private options: (PracticeCard['options'][number] & { tried?: boolean })[] = [];
  private triedWrong = false;
  private done = false;
  private score = 0;
  private onClose: () => void = () => {};

  constructor(private panels: Panels, private h: PracticeHandlers) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<div class="talk-head"><h2 id="${titleId}">Practice phrases</h2><span class="mood" data-count></span></div>`),
      el('<div class="scroll" data-body></div>'),
      el('<div class="foot"><button class="ghost" type="button" data-close>Stop</button><button class="ink" type="button" data-next hidden>Next</button></div>'),
    );
    this.body = pad.querySelector('[data-body]')!;
    this.nextBtn = pad.querySelector('[data-next]')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    this.nextBtn.addEventListener('click', () => this.next());
    overlay.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.close();
      const n = Number(e.key);
      if (n >= 1 && n <= 9 && !this.done) this.pick(n - 1);
    });
    this.body.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      const opt = t.closest<HTMLElement>('[data-opt]');
      if (opt) this.pick(Number(opt.dataset.opt));
      if (t.closest('[data-play]')) {
        const c = this.deck[this.index];
        this.h.say(c.guest, c.guestClip, 'guest', c.lang);
      }
      if (t.closest('[data-reveal]')) {
        t.closest('[data-reveal]')!.replaceWith(el(`<div class="tr">${esc(this.deck[this.index].guestEn)}</div>`));
      }
    });
  }

  open(cards: PracticeCard[], onClose: () => void): void {
    this.onClose = onClose;
    this.deck = cards.slice(0, 10);
    this.index = 0;
    this.score = 0;
    this.panels.show(this.overlay);
    this.show();
  }

  close(): void {
    this.panels.hide(this.overlay);
    this.onClose();
  }

  private show(): void {
    const c = this.deck[this.index];
    this.overlay.querySelector('[data-count]')!.textContent = c ? `${this.index + 1} of ${this.deck.length}` : '';
    if (!c) {
      this.body.innerHTML = `<p class="lead">Done: ${this.score} of ${this.deck.length} right on the first try.</p><p>Phrases learned so far: ${progress.learnedCount()}.</p>`;
      this.nextBtn.hidden = true;
      this.overlay.querySelector<HTMLElement>('[data-close]')!.textContent = 'Back';
      this.overlay.querySelector<HTMLElement>('[data-close]')!.focus();
      return;
    }
    this.overlay.querySelector<HTMLElement>('[data-close]')!.textContent = 'Stop';
    this.options = shuffle(Math.random, c.options).map((o) => ({ ...o }));
    this.triedWrong = false;
    this.done = false;
    this.nextBtn.hidden = true;
    this.render();
    this.h.say(c.guest, c.guestClip, 'guest', c.lang);
    this.body.querySelector<HTMLElement>('[data-opt]')?.focus();
  }

  private render(extra = ''): void {
    const c = this.deck[this.index];
    const lang = esc(c.lang);
    const tr = this.h.showEnglish() ? `<div class="tr">${esc(c.guestEn)}</div>` : '<button class="reveal" type="button" data-reveal>Show English</button>';
    this.body.innerHTML = `
      <p class="status">${esc(languageByCode(c.lang).label)} · the guest says:</p>
      <div class="line guest"><div class="who">Guest <button class="play" type="button" data-play aria-label="Play again">🔊</button></div><div class="said" lang="${lang}">${esc(c.guest)}</div>${tr}</div>
      ${extra}
      <div class="options" style="margin-top:12px">${this.options
        .map((o, i) => `<button class="opt" type="button" data-opt="${i}" lang="${lang}" aria-disabled="${!!o.tried || this.done}"><span class="n" aria-hidden="true">${i + 1}</span><span>${esc(o.text)}</span></button>`)
        .join('')}</div>`;
  }

  private pick(i: number): void {
    const o = this.options[i];
    const c = this.deck[this.index];
    if (!o || o.tried || this.done || !c) return;
    if (!o.correct) {
      o.tried = true;
      this.triedWrong = true;
      this.h.sfx('wrong');
      this.render(`<div class="coach"><span class="mark">✗</span>${esc(o.why ?? '')}</div>`);
      this.body.querySelector<HTMLElement>('[data-opt][aria-disabled="false"]')?.focus();
      return;
    }
    this.done = true;
    this.h.sfx('right');
    if (this.triedWrong) progress.recordMiss(c.lang, { text: c.guest, en: c.guestEn, clipId: c.guestClip }, c.options);
    else {
      progress.recordFirstTry(c.lang, c.guest);
      this.score++;
    }
    this.h.say(o.text, o.clipId, 'you', c.lang);
    this.render(`<div class="coach ok"><span class="mark">✓</span>${esc(o.text)} <span class="tr">(${esc(o.en)})</span></div>`);
    this.nextBtn.hidden = false;
    this.nextBtn.focus();
  }

  private next(): void {
    this.index++;
    this.show();
  }
}

/** Totals, rank and recent shifts. */
export class ProgressPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private onClose: () => void = () => {};

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(el(`<div class="scroll"><h2 id="${titleId}">Your progress</h2><div data-body></div></div>`), el('<div class="foot"><span></span><button class="ink" type="button" data-close>Back</button></div>'));
    this.body = pad.querySelector('[data-body]')!;
    pad.querySelector('[data-close]')!.addEventListener('click', () => this.close());
    overlay.addEventListener('keydown', (e) => e.key === 'Escape' && this.close());
  }

  open(onClose: () => void): void {
    this.onClose = onClose;
    const r = progress.rank();
    const all = progress.totals();
    const toNext = r.next ? `${r.next.from - r.served} more guests to become ${r.next.title}.` : 'Top rank reached!';
    const pct = r.next ? Math.round((r.served / r.next.from) * 100) : 100;
    const perLang = LANGUAGES.map((l) => ({ l, t: progress.totals(l.code) })).filter((x) => x.t.shifts);
    const recent = progress.shifts().slice(-8).reverse();
    this.body.innerHTML = `
      <p class="field">${esc(r.title)}</p><p class="status">${r.served} guest${r.served === 1 ? '' : 's'} served. ${esc(toNext)}</p>
      <div class="bar" aria-hidden="true"><i style="width:${pct}%;background:var(--basil)"></i></div>
      <div class="summary-stats">
        <div><b>${all.shifts}</b>shifts</div><div><b>${money(all.tips)}</b>total tips</div>
        <div><b>${money(all.bestTips)}</b>best shift</div>
        <div><b>${all.turns ? Math.round((all.firstTry / all.turns) * 100) : 0}%</b>lines right first try</div>
        <div><b>${progress.learnedCount()}</b>phrases learned</div><div><b>${progress.toPractice().length}</b>to practice</div>
      </div>
      ${perLang.length ? `<p class="field">By language</p><ul class="incidents">${perLang.map(({ l, t }) => `<li>${esc(l.label)}: ${t.shifts} shift${t.shifts > 1 ? 's' : ''}, ${t.served} guest${t.served === 1 ? '' : 's'}, ${money(t.tips)} in tips</li>`).join('')}</ul>` : ''}
      <p class="field">Recent shifts</p>
      ${recent.length ? `<ul class="incidents">${recent.map((s) => `<li>${esc(new Date(s.date).toLocaleDateString())} · ${esc(languageByCode(s.lang).label)}, ${esc(difficultyById(s.difficulty).label)}: ${s.served}/${s.total} served, ${money(s.tips)}, rating ${s.rating.toFixed(1)}</li>`).join('')}</ul>` : '<p class="lead">No shifts yet. Finish one and it shows up here.</p>'}
      <p class="status">Progress is saved in this browser on this device.</p>`;
    this.panels.show(this.overlay);
  }

  close(): void {
    this.panels.hide(this.overlay);
    this.onClose();
  }
}
