import * as THREE from 'three';
import { mesh, toon } from './materials';
import { PALETTE } from './palette';

export interface PersonLook {
  shirt: number;
  skin: number;
  hair: number;
}

/** A simple chunky figure: body, head, hair cap and two dot eyes. Faces +z. */
export function makePerson({ shirt, skin, hair }: PersonLook): THREE.Group {
  const g = new THREE.Group();
  const body = mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.9, 12), toon(shirt));
  body.position.y = 0.95;
  const head = mesh(new THREE.SphereGeometry(0.27, 16, 12), toon(skin));
  head.position.y = 1.62;
  const hairCap = mesh(new THREE.SphereGeometry(0.29, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), toon(hair));
  hairCap.position.y = 1.66;
  hairCap.rotation.x = -0.25;
  g.add(body, head, hairCap);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.035, 6, 6), toon(PALETTE.eye), false);
    eye.position.set(0.09 * side, 1.64, 0.25);
    g.add(eye);
  }
  return g;
}

export interface WaiterModel {
  root: THREE.Group;
  /** Shown when carrying food. Drinks are added in milestone 2. */
  trayPlate: THREE.Group;
}

/** The player: a person with trousers, apron and a red bow tie. */
export function makeWaiter(): WaiterModel {
  const w = PALETTE.waiter;
  const root = makePerson({ shirt: w.shirt, skin: w.skin, hair: w.hair });
  for (const side of [-1, 1]) {
    const leg = mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.55, 8), toon(w.trousers));
    leg.position.set(0.14 * side, 0.27, 0);
    root.add(leg);
  }
  const apron = mesh(new THREE.BoxGeometry(0.62, 0.6, 0.06), toon(w.apron));
  apron.position.set(0, 0.78, 0.33);
  const bow = mesh(new THREE.BoxGeometry(0.22, 0.08, 0.05), toon(w.bow));
  bow.position.set(0, 1.36, 0.3);
  const trayPlate = makePlate(PALETTE.food[0]);
  trayPlate.position.set(0.45, 1.18, 0.22);
  trayPlate.visible = false;
  root.add(apron, bow, trayPlate);
  return { root, trayPlate };
}

/** A plate with a dome of food on it. */
export function makePlate(foodColor: number): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.04, 16), toon(PALETTE.plate)));
  const food = mesh(new THREE.SphereGeometry(0.14, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(foodColor));
  food.position.y = 0.02;
  g.add(food);
  return g;
}
