/** Entry point: loads fonts and styles, then starts the game. */
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
// Kalam has no Russian letters; Caveat fills in Cyrillic in the same handwritten style.
import '@fontsource/caveat/cyrillic-400.css';
import '@fontsource/caveat/cyrillic-700.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/pad.css';
import './styles/panels.css';
import { Game } from './app/game';

const game = new Game(document.querySelector<HTMLCanvasElement>('#scene')!);

// In development only, expose the game for debugging from the browser console.
if (import.meta.env.DEV) (window as unknown as { firstShift: Game }).firstShift = game;
