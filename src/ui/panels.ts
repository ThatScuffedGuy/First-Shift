/**
 * Keeps track of open panels (start screen, dialogue, ticket...). While any
 * panel is open, the waiter can't move and the game clock is paused.
 */
export class Panels {
  private open = new Set<HTMLElement>();
  private lastFocus: HTMLElement | null = null;

  show(el: HTMLElement, focus?: HTMLElement): void {
    if (this.open.size === 0) this.lastFocus = document.activeElement as HTMLElement | null;
    el.hidden = false;
    this.open.add(el);
    (focus ?? el.querySelector<HTMLElement>('button, [href], input'))?.focus();
  }

  hide(el: HTMLElement): void {
    el.hidden = true;
    this.open.delete(el);
    if (this.open.size === 0) this.lastFocus?.focus?.();
  }

  get anyOpen(): boolean {
    return this.open.size > 0;
  }
}
