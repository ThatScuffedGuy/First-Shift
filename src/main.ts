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

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = createRenderer(canvas);
const scene = new THREE.Scene();
scene.background = new THREE.Color(SCENE_BG.light);
const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);

addLights(scene, HOUSE_LAYOUT);
const restaurant = buildRestaurant(scene, HOUSE_LAYOUT);
document.fonts?.ready.then(() => restaurant.redrawText());

const waiter = makeWaiter();
waiter.root.position.set(HOUSE_LAYOUT.waiterStart.x, 0, HOUSE_LAYOUT.waiterStart.z);
scene.add(waiter.root);

// Temporary camera from the prototype; replaced by the screen-fitting camera next.
function resize(): void {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const k = Math.min(3, Math.max(1, 1.55 / camera.aspect));
  camera.position.set(0, 15.5 * k, 13.5 * k);
  camera.lookAt(0, 0, 0.3);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();
renderer.setAnimationLoop(() => renderer.render(scene, camera));
