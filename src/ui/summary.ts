import type { Shift } from '../game/shift';
import { createPanel, el, esc, money } from './dom';
import type { Panels } from './panels';

/** End-of-shift report: results, what went wrong, and phrases to practice. */
export class SummaryPanel {
  private overlay: HTMLElement;
  private body: HTMLElement;
  private onAgain: () => void = () => {};
  private onPlay: (text: string) => void = () => {};

  constructor(private panels: Panels) {
    const { overlay, pad, titleId } = createPanel();
    this.overlay = overlay;
    pad.append(
      el(`<div class="scroll"><h1 id="${titleId}">Shift’s over</h1><div data-body></div></div>`),
      el('<div class="foot"><span></span><button class="ink" type="button" data-again>Start another shift</button></div>'),
    );
    this.body = pad.querySelector('[data-body]')!;
    pad.querySelector('[data-again]')!.addEventListener('click', () => this.onAgain());
    this.body.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-say]');
      if (b) this.onPlay(b.dataset.say!);
    });
  }

  open(shift: Shift, clock: string, onAgain: () => void, onPlay: (text: string) => void): void {
    this.onAgain = onAgain;
    this.onPlay = onPlay;
    const s = shift.stats;
    const served = shift.records.filter((r) => r.outcome === 'served');
    const avg = shift.records.length ? shift.records.reduce((a, r) => a + r.stars, 0) / shift.records.length : 0;
    const lang = esc(shift.pack.code);
    const stars = '★★★★★'.slice(0, Math.round(avg)) + '☆☆☆☆☆'.slice(0, 5 - Math.round(avg));

    const went: string[] = [...shift.incidents];
    const issues = went.length
      ? `<ul class="incidents">${went.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
      : '<p>No walkouts, spills, wrong orders or allergy scares. Clean shift.</p>';
    const tally = [
      s.wrongDrinks && `${s.wrongDrinks} wrong drink${s.wrongDrinks > 1 ? 's' : ''}`,
      s.wrongDishes && `${s.wrongDishes} wrong dish${s.wrongDishes > 1 ? 'es' : ''}`,
      s.allergyReactions && `${s.allergyReactions} allergic reaction${s.allergyReactions > 1 ? 's' : ''}`,
      s.unflaggedAllergies && `${s.unflaggedAllergies} unflagged allerg${s.unflaggedAllergies > 1 ? 'ies' : 'y'}`,
      s.spills && `${s.spills} spill${s.spills > 1 ? 's' : ''}`,
      s.walkouts && `${s.walkouts} walkout${s.walkouts > 1 ? 's' : ''}`,
    ].filter(Boolean);

    const phrases = shift.missed.length
      ? shift.missed
          .map(
            (m) => `<div class="phrase"><div class="desc">You picked: <span lang="${lang}">${esc(m.said)}</span></div>
            <div class="better" lang="${lang}">${esc(m.better)} <button class="play" type="button" data-say="${esc(m.better)}" aria-label="Play this phrase">🔊</button></div>
            <div class="desc">“${esc(m.betterEn)}” ${esc(m.why)}</div></div>`,
          )
          .join('')
      : '<p class="lead">You didn’t miss a single line.</p>';

    this.body.innerHTML = `
      <div class="summary-stats">
        <div><b>${served.length}/${shift.total}</b>guests served</div>
        <div><b>${money(shift.tips)}</b>in tips</div>
        <div><b>${avg.toFixed(1)}</b><span aria-hidden="true">${stars}</span> average rating</div>
        <div><b>${s.firstTry}/${s.turns}</b>lines right on the first try</div>
        <div><b>${esc(clock)}</b>shift ended</div>
      </div>
      <p class="field">What went wrong${tally.length ? `: ${tally.join(', ')}` : ''}</p>${issues}
      <p class="field">Phrases to practice</p>${phrases}`;
    this.panels.show(this.overlay, this.overlay.querySelector<HTMLElement>('[data-again]')!);
  }

  close(): void {
    this.panels.hide(this.overlay);
  }
}
