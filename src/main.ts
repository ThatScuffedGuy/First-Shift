/**
 * Entry point: builds the scene, the waiter and the interface, then runs the
 * main loop. Each part lives in its own module; this file only connects them.
 */
import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/hud.css';
import './styles/pad.css';
import * as THREE from 'three';
import { HOUSE_LAYOUT as LAYOUT } from './data/layout';
import { TIMING } from './data/timing';
import { PLACE_HINTS } from './data/hints';
import { createRenderer } from './scene/renderer';
import { addLights } from './scene/lights';
import { buildRestaurant } from './scene/restaurant';
import { makeWaiter } from './scene/characters';
import { CameraRig } from './scene/camera';
import { TapMarker } from './scene/tapMarker';
import { createWaiter, obstaclesOf, stepWaiter, tapDestination } from './game/waiter';
import { placeAt } from './game/zones';
import { formatClock } from './game/clock';
import { Keyboard } from './input/keyboard';
import { onFloorTap } from './input/pointer';
import { Hud } from './ui/hud';
import { ActionButton, type Action } from './ui/actionButton';
import { Panels } from './ui/panels';
import { Theme } from './ui/theme';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

// --- Scene ---
const canvas = $<HTMLCanvasElement>('scene');
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
const rig = new CameraRig(LAYOUT);
addLights(scene, LAYOUT);
const restaurant = buildRestaurant(scene, LAYOUT);
document.fonts?.ready.then(() => restaurant.redrawText());
const waiterModel = makeWaiter();
scene.add(waiterModel.root);
const marker = new TapMarker();
scene.add(marker.object);

// --- Interface ---
const hud = new Hud();
const action = new ActionButton();
const panels = new Panels();
const theme = new Theme($<HTMLButtonElement>('themeBtn'));
const syncSceneColour = () => {
  scene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue('--scene-bg').trim() || '#22343c');
};
theme.onChange(syncSceneColour);
syncSceneColour();

const startWrap = $('startWrap');
panels.show(startWrap, $('startBtn'));
$('startBtn').addEventListener('click', () => {
  panels.hide(startWrap);
  running = true;
});

// --- Game state ---
let running = false;
const gameTime = 0; // the clock starts running in milestone 2, when guests arrive
const waiter = createWaiter(LAYOUT);
const obstacles = obstaclesOf(LAYOUT);
const canMove = () => running && !panels.anyOpen;

// --- Input ---
const keyboard = new Keyboard(canMove, () => action.press());
onFloorTap(canvas, rig.camera, canMove, (tap) => {
  waiter.target = tapDestination(tap, waiter, LAYOUT);
  marker.show(waiter.target.x, waiter.target.z);
});

/** What the action button offers where the waiter is standing. Guests add real actions in milestone 2. */
function currentAction(): Action | null {
  if (!canMove()) return null;
  const place = placeAt(waiter, LAYOUT);
  if (!place) return null;
  if (place.kind === 'table') return PLACE_HINTS.table(place.table.number);
  return PLACE_HINTS.station[place.station.kind];
}

// --- Screen size ---
// Keep the room clear of the top bar, whose height changes when it wraps on small screens.
function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.resize(w, h, { top: hud.element.getBoundingClientRect().bottom, bottom: 0, left: 0, right: 0 });
  rig.update(0, waiter.x, true);
}
window.addEventListener('resize', resize);
new ResizeObserver(resize).observe(hud.element);
resize();

// --- Main loop ---
const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(0.05, timer.getDelta()); // cap so a background tab doesn't teleport the waiter
  const now = timer.getElapsed();

  stepWaiter(waiter, keyboard.direction(), dt, LAYOUT, obstacles);
  action.show(currentAction());
  hud.setClock(formatClock(gameTime, TIMING.shiftStartHour));

  const m = waiterModel.root;
  m.position.set(waiter.x, waiter.moving ? Math.abs(Math.sin(now * 11)) * 0.07 : 0, waiter.z);
  m.rotation.y = waiter.heading;
  marker.update(dt, waiter.target !== null);
  rig.update(dt, waiter.x);
  renderer.render(scene, rig.camera);
});
