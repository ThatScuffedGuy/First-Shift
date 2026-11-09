import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './style.css';
import * as THREE from 'three';
import { HOUSE_LAYOUT as LAYOUT } from './data/layout';
import { createRenderer } from './scene/renderer';
import { addLights } from './scene/lights';
import { buildRestaurant } from './scene/restaurant';
import { makeWaiter } from './scene/characters';
import { SCENE_BG } from './scene/palette';
import { CameraRig } from './scene/camera';
import { TapMarker } from './scene/tapMarker';
import { createWaiter, obstaclesOf, stepWaiter, tapDestination } from './game/waiter';
import { Keyboard } from './input/keyboard';
import { onFloorTap } from './input/pointer';

// --- Scene ---
const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BG.light);
const rig = new CameraRig(LAYOUT);
addLights(scene, LAYOUT);
const restaurant = buildRestaurant(scene, LAYOUT);
document.fonts?.ready.then(() => restaurant.redrawText());
const waiterModel = makeWaiter();
scene.add(waiterModel.root);
const marker = new TapMarker();
scene.add(marker.object);

// --- Game state ---
const waiter = createWaiter(LAYOUT);
const obstacles = obstaclesOf(LAYOUT);
const canMove = () => true;

// --- Input ---
const keyboard = new Keyboard(canMove, () => {});
onFloorTap(canvas, rig.camera, canMove, (tap) => {
  waiter.target = tapDestination(tap, waiter, LAYOUT);
  marker.show(waiter.target.x, waiter.target.z);
});

// --- Layout ---
// Space the HUD covers; measured from the real HUD in a later step.
const insets = { top: 60, bottom: 0, left: 0, right: 0 };
function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.resize(w, h, insets);
  rig.update(0, waiter.x, true);
}
window.addEventListener('resize', resize);
resize();

// --- Main loop ---
const timer = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  timer.update(time);
  const dt = Math.min(0.05, timer.getDelta()); // cap so a background tab doesn't teleport the waiter
  const now = timer.getElapsed();

  stepWaiter(waiter, keyboard.direction(), dt, LAYOUT, obstacles);

  const m = waiterModel.root;
  m.position.set(waiter.x, waiter.moving ? Math.abs(Math.sin(now * 11)) * 0.07 : 0, waiter.z);
  m.rotation.y = waiter.heading;
  marker.update(dt, waiter.target !== null);
  rig.update(dt, waiter.x);
  renderer.render(scene, rig.camera);
});
