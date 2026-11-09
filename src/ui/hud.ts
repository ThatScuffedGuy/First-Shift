const $ = (id: string) => document.getElementById(id)!;

/** The top bar: language, clock, guests served and tips. */
export class Hud {
  readonly element = $('hud');
  private clock = $('hudClock');
  private guests = $('hudGuests');
  private tips = $('hudTips');
  private lang = $('hudLang');

  setClock(text: string): void {
    if (this.clock.textContent !== text) this.clock.textContent = text;
  }
  setGuests(done: number, total: number): void {
    this.guests.textContent = `${done}/${total}`;
  }
  setTips(dollars: number): void {
    this.tips.textContent = `$${dollars.toFixed(2)}`;
  }
  setLanguage(name: string): void {
    this.lang.textContent = name;
  }
}
