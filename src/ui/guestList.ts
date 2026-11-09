import { MOODS, STATUS } from '../data/hints';
import type { Shift } from '../game/shift';
import { moodColour } from '../scene/bubbles';
import { el, esc, mmss } from './dom';

/** The side list of guests: where they are, what they're waiting for, and how patient they still are. */
export class GuestList {
  private box = document.body.appendChild(el('<aside class="guests" aria-label="Your guests"></aside>'));
  private key = '';

  render(shift: Shift | null): void {
    if (!shift) {
      this.box.replaceChildren();
      this.key = '';
      return;
    }
    const rows = shift.guests.map((g) => {
      const where = g.table ? `Table ${g.table}` : g.state === 'following' ? 'Following you' : 'At the door';
      const left = shift.patienceLeft(g);
      const timer = g.phase ? ` · waiting ${mmss(g.waited)}` : '';
      const bar = g.phase ? `<div class="bar" aria-hidden="true"><i style="width:${Math.round(left * 100)}%;background:${moodColour(g.mood)}"></i></div>` : '';
      return {
        html: `<div class="gl"><b>${MOODS[g.mood].face} ${esc(where)}</b> <span class="t">· ${esc(g.persona.label)}</span><div class="t">${esc(STATUS[g.state].text)}${timer}</div>${bar}</div>`,
        key: `${g.id}${g.state}${g.mood}${Math.round(left * 20)}${Math.floor(g.waited / 5)}`,
      };
    });
    const key = rows.map((r) => r.key).join('|');
    if (key === this.key) return;
    this.key = key;
    this.box.innerHTML = rows.map((r) => r.html).join('');
  }
}
