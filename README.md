# First Shift

A stylized 3D game that trains aspiring waiters for real restaurant work while teaching a foreign language (Spanish and Russian to start).

## Running it

You need [Node.js](https://nodejs.org) 20 or newer.

```bash
npm install
npm run dev
```

Then open the link it prints (usually http://localhost:5173). To try it on your phone, connect the phone to the same Wi-Fi and open the "Network" link instead.

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Runs the game locally and reloads when files change. |
| `npm test` | Runs the automated tests. |
| `npm run check` | Type check, tests and a production build. Run before committing. |
| `npm run build` | Makes the finished game in `dist/`. |
| `npm run preview` | Serves the built `dist/` folder so you can test it. |

## How the code is organised

| Folder | What lives there |
| --- | --- |
| `src/data/` | Everything you might want to tweak without touching game logic: the floor plan (`layout.ts`), clock and movement speeds (`timing.ts`), camera settings (`view.ts`) and interface hints (`hints.ts`). Dialogue, menus and languages will live here too. |
| `src/game/` | Game rules with no 3D code: waiter movement and collisions, which station you're at, the clock. Easy to test. |
| `src/scene/` | The 3D view: renderer, lights, the restaurant, characters, the screen-fitting camera. |
| `src/input/` | Keyboard and tap/click handling. |
| `src/ui/` | The interface around the 3D view: top bar, action button, panels, light/dark theme. |
| `src/styles/` | Colours (light and dark), the order-pad panel look, HUD styles. |
| `tests/` | Automated checks, run with `npm test`. |

Fonts (Kalam and Bricolage Grotesque) are bundled with the game, so it runs offline.
