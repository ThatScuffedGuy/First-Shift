import '@fontsource/kalam/400.css';
import '@fontsource/kalam/700.css';
import '@fontsource-variable/bricolage-grotesque/opsz.css';
import './style.css';
import * as THREE from 'three';
import { HOUSE_LAYOUT } from './data/layout';
import { createRenderer } from './scene/renderer';
import { addLights } from './scene/lights';
import { buildRestaurant } from './scene/restaurant';
import { makeWaiter } from './scene/characters';
import { SCENE_BG } from './scene/palette';
import { CameraRig } from './scene/camera';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BG.light);
const rig = new CameraRig(HOUSE_LAYOUT);

addLights(scene, HOUSE_LAYOUT);
const restaurant = buildRestaurant(scene, HOUSE_LAYOUT);
document.fonts?.ready.then(() => restaurant.redrawText());

const waiter = makeWaiter();
waiter.root.position.set(HOUSE_LAYOUT.waiterStart.x, 0, HOUSE_LAYOUT.waiterStart.z);
scene.add(waiter.root);

// Space the HUD covers; measured from the real HUD in a later step.
const insets = { top: 60, bottom: 0, left: 0, right: 0 };

function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  rig.resize(w, h, insets);
  rig.update(0, waiter.root.position.x, true);
}
window.addEventListener('resize', resize);
resize();

const clock = new THREE.Timer();
renderer.setAnimationLoop((time) => {
  clock.update(time);
  const dt = Math.min(0.05, clock.getDelta());
  rig.update(dt, waiter.root.position.x);
  renderer.render(scene, rig.camera);
});
