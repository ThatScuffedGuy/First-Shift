# First Shift

A stylized 3D game that trains aspiring waiters for real restaurant work while teaching a foreign language (Spanish and Russian to start).

## Playing it (no setup)

Open the `play` folder and double-click **First-Shift.html**. It opens in your web browser (Chrome, Edge, Firefox or Safari). Nothing to install. This file is rebuilt with `npm run build:file` whenever the game changes.

## Running it as a developer

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
| `npm run audio` | Writes the voice-recording checklists (see below). |
| `npm run build:file` | Makes the double-click version in `play/First-Shift.html`. |
| `npm run preview` | Serves the built `dist/` folder so you can test it. |

## Recording voice lines

Every spoken line has a stable ID. Run `npm run audio` to write a checklist per language in `audio-script/` (`es.md`, `ru.md`, plus spreadsheet-friendly `.csv` files). Each row gives the exact file name, who's speaking (the waiter, or which kind of guest), the line and its English.

Save recordings in `public/audio/<language>/` with those names, for example `public/audio/es/door.polite.1.guest.mp3`. mp3, m4a, ogg, wav and webm all work. Run `npm run audio` again to tick them off. The game plays your recording when one exists and the device's speech voice otherwise, and shows 🎙️ instead of 🔊 next to recorded lines. Start with "Part 1": about 156 lines per language that never change.

## Adding a language

1. Copy `src/data/languages/es.json` to a new file, e.g. `fr.json`, and translate it (keep the IDs; change `code`, `label`, `speechLang`, `listAnd`, `testLine` and `allergens`).
2. Add the language's names to every item in `src/data/menus/house.json`.
3. Run `npm test`. The dialogue check names any line that's missing, has no reason, or uses a misspelled `{token}`.

The new language appears on the start screen automatically.

## How the code is organised

| Folder | What lives there |
| --- | --- |
| `src/data/` | Everything you might want to tweak without touching game logic: dialogue per language (`languages/*.json`), the menu (`menus/house.json`), timing and scoring (`timing.ts`), guest personalities (`personas.ts`), the floor plan (`layout.ts`), accidents, tutorial text and interface hints. |
| `src/game/` | Game rules with no 3D code: the shift simulation (guests, patience, kitchen, tips), waiter movement, what the action button offers, the tutorial. Easy to test. |
| `src/dialogue/` | The dialogue engine: picks lines by persona and mood, fills in dish and drink names, builds the three options. |
| `src/audio/` | Recorded clips with speech fallback, and synthesised sound effects. |
| `src/app/` | Connects the simulation, the 3D view, the screens and audio. |
| `src/scene/` | The 3D view: renderer, lights, the restaurant, characters, the screen-fitting camera. |
| `src/input/` | Keyboard and tap/click handling. |
| `src/ui/` | The interface around the 3D view: top bar, action button, panels, light/dark theme. |
| `src/styles/` | Colours (light and dark), the order-pad panel look, HUD styles. |
| `tests/` | Automated checks, run with `npm test`. |

Fonts (Kalam and Bricolage Grotesque) are bundled with the game, so it runs offline.
