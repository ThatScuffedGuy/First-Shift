import * as THREE from 'three';
import type { RestaurantLayout } from '../data/types';
import { LEGACY_LIGHT } from './renderer';
import { place } from './materials';

/** Warm sky light, one shadow-casting "sun", and two lamps over the back counters. */
export function addLights(scene: THREE.Scene, layout: RestaurantLayout): void {
  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x40352a, 0.75 * LEGACY_LIGHT));

  const sun = new THREE.DirectionalLight(0xffffff, 0.75 * LEGACY_LIGHT);
  sun.position.set(6, 16, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  // Small offsets stop the speckled "shadow acne" pattern on curved surfaces.
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.03;
  const halfW = layout.floor.width / 2 + 3;
  const halfD = layout.floor.depth / 2 + 4;
  Object.assign(sun.shadow.camera, { left: -halfW, right: halfW, top: halfD, bottom: -halfD, near: 1, far: 40 });
  scene.add(sun);

  // Lamps over the kitchen pass and drink station. decay 1 matches the old, softer fall-off.
  const back = -layout.floor.depth / 2 + 1.5;
  for (const s of layout.stations.filter((st) => st.kind !== 'door')) {
    const lamp = new THREE.PointLight(s.kind === 'pass' ? 0xffb866 : 0xffd29a, (s.kind === 'pass' ? 0.55 : 0.45) * LEGACY_LIGHT, 14, 1);
    place(scene, lamp, s.center.x, 3, back);
  }
}
