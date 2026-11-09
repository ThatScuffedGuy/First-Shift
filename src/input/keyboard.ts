import type { Point } from '../data/types';

const UP = ['w', 'arrowup'];
const DOWN = ['s', 'arrowdown'];
const LEFT = ['a', 'arrowleft'];
const RIGHT = ['d', 'arrowright'];
const MOVE_KEYS = new Set([...UP, ...DOWN, ...LEFT, ...RIGHT]);

/** Tracks which movement keys are held. Ignores keys while typing in a text field. */
export class Keyboard {
  private held = new Set<string>();

  constructor(private enabled: () => boolean, onAction: () => void) {
    window.addEventListener('keydown', (e) => {
      const el = e.target as HTMLElement | null;
      if (el?.closest?.('input, textarea, select')) return;
      if (!this.enabled()) return;
      const k = e.key.toLowerCase();
      if (MOVE_KEYS.has(k)) {
        this.held.add(k);
        e.preventDefault(); // stop arrow keys scrolling the page
      }
      // E acts. Enter and Space are left alone so buttons keep working normally.
      if (k === 'e' && !e.repeat) onAction();
    });
    window.addEventListener('keyup', (e) => this.held.delete(e.key.toLowerCase()));
    // Releasing keys while the window is in the background never fires keyup.
    window.addEventListener('blur', () => this.held.clear());
  }

  /** Direction from held keys: x is right, z is towards the front of the room. */
  direction(): Point {
    if (!this.enabled()) {
      this.held.clear();
      return { x: 0, z: 0 };
    }
    const on = (keys: string[]) => keys.some((k) => this.held.has(k));
    return { x: (on(RIGHT) ? 1 : 0) - (on(LEFT) ? 1 : 0), z: (on(DOWN) ? 1 : 0) - (on(UP) ? 1 : 0) };
  }
}
