import * as THREE from 'three';
import type { PersonaKind } from '../data/types';
import { mesh, toon } from './materials';
import { PALETTE } from './palette';
import { type Rng, pick, seeded } from '../game/random';

export type HairStyle = 'short' | 'long' | 'bun' | 'curly' | 'bald';
export type Accessory = 'none' | 'sunhat' | 'tie' | 'glasses' | 'scarf';

export interface PersonLook {
  shirt: number;
  skin: number;
  hair: number;
  trousers: number;
  hairStyle: HairStyle;
  accessory: Accessory;
}

/** A jointed cartoon figure. Faces +z. Limbs pivot at the hip and shoulder for animation. */
export interface Person {
  root: THREE.Group;
  /** Everything above the legs; bobs while walking. */
  upper: THREE.Group;
  legs: [THREE.Group, THREE.Group];
  arms: [THREE.Group, THREE.Group];
  mouth: { smile: THREE.Mesh; flat: THREE.Mesh; frown: THREE.Mesh };
  /** Where a carried item sits (in the right hand, in root space). */
  hand: THREE.Group;
  phase: number;
}

const HIP_Y = 0.5;
const SHOULDER_Y = 1.24;

const SHIRTS = [0x3f7cac, 0xe0a458, 0x7a5c9e, 0x4f9d69, 0xd1495b, 0x2e4057, 0xedae49, 0x5bc0be, 0xe07a5f, 0x81b29a];
const SKINS = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac, 0xa86b3c];
const HAIRS = [0x2c1b10, 0x6b4423, 0xd8b26e, 0x1a1a1a, 0x9a3b1f, 0xb5b5b5];
const TROUSERS = [0x2b3a55, 0x3d3d3d, 0x5c4a3a, 0x40594a, 0x24303e];

/** Random but repeatable looks for a guest; the persona adds a small visual hint. */
export function guestLook(seed: number, persona: PersonaKind): PersonLook {
  const rng: Rng = seeded(seed);
  const accessory: Accessory = persona === 'tourist' ? 'sunhat' : persona === 'rushed' ? 'tie' : persona === 'indecisive' ? 'glasses' : persona === 'warm' && rng() < 0.5 ? 'scarf' : 'none';
  return {
    shirt: pick(rng, SHIRTS),
    skin: pick(rng, SKINS),
    hair: pick(rng, HAIRS),
    trousers: pick(rng, TROUSERS),
    hairStyle: pick(rng, ['short', 'long', 'bun', 'curly', 'short', 'bald'] as HairStyle[]),
    accessory,
  };
}

export function makePerson(look: PersonLook): Person {
  const root = new THREE.Group();
  const upper = new THREE.Group();
  root.add(upper);

  // Legs, pivoting at the hip.
  const legs = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.13 * side, HIP_Y, 0);
    const leg = mesh(new THREE.CylinderGeometry(0.11, 0.1, 0.46, 8), toon(look.trousers));
    leg.position.y = -0.23;
    const shoe = mesh(new THREE.BoxGeometry(0.17, 0.09, 0.27), toon(0x2a2422));
    shoe.position.set(0, -0.46, 0.05);
    pivot.add(leg, shoe);
    root.add(pivot);
    return pivot;
  }) as [THREE.Group, THREE.Group];

  // Body
  const body = mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.82, 14), toon(look.shirt));
  body.position.y = 0.9;
  const shoulders = mesh(new THREE.SphereGeometry(0.3, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(look.shirt));
  shoulders.position.y = 1.3;
  shoulders.scale.y = 0.45;
  upper.add(body, shoulders);

  // Arms, pivoting at the shoulder.
  const arms = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    pivot.position.set(0.37 * side, SHOULDER_Y, 0);
    const arm = mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.5, 8), toon(look.shirt));
    arm.position.y = -0.25;
    const handMesh = mesh(new THREE.SphereGeometry(0.08, 8, 6), toon(look.skin));
    handMesh.position.y = -0.52;
    pivot.add(arm, handMesh);
    upper.add(pivot);
    return pivot;
  }) as [THREE.Group, THREE.Group];

  // Head and face
  const head = new THREE.Group();
  head.position.y = 1.62;
  upper.add(head);
  head.add(mesh(new THREE.SphereGeometry(0.27, 18, 14), toon(look.skin)));
  const eyeMat = toon(PALETTE.eye);
  for (const side of [-1, 1]) {
    const eye = mesh(new THREE.SphereGeometry(0.036, 8, 6), eyeMat, false);
    eye.position.set(0.09 * side, 0.03, 0.245);
    eye.scale.set(1, 1.3, 1);
    head.add(eye);
  }
  const mouthMat = toon(0x6b2a2a);
  const arc = new THREE.TorusGeometry(0.06, 0.014, 6, 12, Math.PI);
  const smile = mesh(arc, mouthMat, false);
  smile.rotation.z = Math.PI;
  smile.position.set(0, -0.06, 0.25);
  const frown = mesh(arc, mouthMat, false);
  frown.position.set(0, -0.11, 0.24);
  const flat = mesh(new THREE.BoxGeometry(0.1, 0.022, 0.02), mouthMat, false);
  flat.position.set(0, -0.09, 0.255);
  head.add(smile, frown, flat);
  addHair(head, look);
  addAccessory(head, upper, look);

  // Anchor for carried items: where the raised arm's hand ends up.
  const hand = new THREE.Group();
  hand.position.set(0.4, 1.27, 0.5);
  upper.add(hand);

  const person: Person = { root, upper, legs, arms, mouth: { smile, flat, frown }, hand, phase: Math.random() * 6 };
  setMood(person, 3);
  return person;
}

function addHair(head: THREE.Group, look: PersonLook): void {
  const mat = toon(look.hair);
  if (look.hairStyle === 'bald') return;
  const cap = mesh(new THREE.SphereGeometry(0.29, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat);
  cap.position.y = 0.03;
  cap.rotation.x = -0.25;
  head.add(cap);
  if (look.hairStyle === 'long') {
    const back = mesh(new THREE.CylinderGeometry(0.27, 0.24, 0.42, 14, 1, true, Math.PI * 0.6, Math.PI * 0.8), mat);
    back.position.set(0, -0.12, -0.04);
    back.material = toon(look.hair, { side: THREE.DoubleSide });
    head.add(back);
  } else if (look.hairStyle === 'bun') {
    const bun = mesh(new THREE.SphereGeometry(0.12, 10, 8), mat);
    bun.position.set(0, 0.24, -0.16);
    head.add(bun);
  } else if (look.hairStyle === 'curly') {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      const puff = mesh(new THREE.SphereGeometry(0.09, 8, 6), mat);
      puff.position.set(Math.cos(a) * 0.22, 0.14 + Math.sin(i * 1.7) * 0.03, Math.sin(a) * 0.22 - 0.04);
      head.add(puff);
    }
  }
}

function addAccessory(head: THREE.Group, upper: THREE.Group, look: PersonLook): void {
  if (look.accessory === 'sunhat') {
    const straw = toon(0xe8cf8f);
    const brim = mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.03, 20), straw);
    brim.position.y = 0.2;
    const crown = mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.2, 16), straw);
    crown.position.y = 0.3;
    const band = mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.05, 16), toon(0xd1495b));
    band.position.y = 0.23;
    head.add(brim, crown, band);
  } else if (look.accessory === 'tie') {
    const tie = mesh(new THREE.BoxGeometry(0.09, 0.42, 0.03), toon(0xb3262e));
    tie.position.set(0, 1.05, 0.34);
    tie.rotation.x = -0.12;
    upper.add(tie);
  } else if (look.accessory === 'glasses') {
    const frame = toon(0x1d1d1d);
    for (const side of [-1, 1]) {
      const lens = mesh(new THREE.TorusGeometry(0.06, 0.012, 6, 14), frame, false);
      lens.position.set(0.09 * side, 0.03, 0.26);
      head.add(lens);
    }
    const bridge = mesh(new THREE.BoxGeometry(0.06, 0.012, 0.012), frame, false);
    bridge.position.set(0, 0.04, 0.27);
    head.add(bridge);
  } else if (look.accessory === 'scarf') {
    const scarf = mesh(new THREE.TorusGeometry(0.22, 0.07, 8, 18), toon(0xe9c46a));
    scarf.rotation.x = Math.PI / 2;
    scarf.position.y = 1.38;
    upper.add(scarf);
  }
}

/** Shows the mood on the face: smile at 4+, flat at 2-3, frown at 0-1. */
export function setMood(p: Person, mood: number): void {
  p.mouth.smile.visible = mood >= 4;
  p.mouth.flat.visible = mood === 2 || mood === 3;
  p.mouth.frown.visible = mood <= 1;
}

export interface PoseInput {
  dt: number;
  /** Walking speed in m/s (0 when still). */
  speed: number;
  sitting?: boolean;
  carrying?: boolean;
  reducedMotion?: boolean;
}

/** Walk cycle, sitting and carrying poses. Call every frame. */
export function animatePerson(p: Person, { dt, speed, sitting, carrying, reducedMotion }: PoseInput): void {
  const walking = speed > 0.05 && !sitting;
  p.phase += dt * (walking ? 4 + speed * 1.6 : 1.4);
  const swing = walking && !reducedMotion ? Math.sin(p.phase) * 0.6 : 0;
  const ease = (obj: THREE.Object3D, x: number) => (obj.rotation.x += (x - obj.rotation.x) * Math.min(1, dt * 14));

  if (sitting) {
    ease(p.legs[0], -Math.PI / 2);
    ease(p.legs[1], -Math.PI / 2);
  } else {
    ease(p.legs[0], swing);
    ease(p.legs[1], -swing);
  }
  ease(p.arms[0], sitting ? -0.5 : -swing * 0.7);
  ease(p.arms[1], carrying ? -1.45 : sitting ? -0.5 : swing * 0.7);
  p.arms[0].rotation.z = -0.08;
  p.arms[1].rotation.z = carrying ? 0.25 : 0.08;

  const bob = walking && !reducedMotion ? Math.abs(Math.sin(p.phase)) * 0.05 : reducedMotion ? 0 : Math.sin(p.phase) * 0.008;
  p.upper.position.y = bob;
}

/** The player: a person with an apron and a red bow tie. */
export function makeWaiter(): Person {
  const w = PALETTE.waiter;
  const p = makePerson({ shirt: w.shirt, skin: w.skin, hair: w.hair, trousers: w.trousers, hairStyle: 'short', accessory: 'none' });
  const apron = mesh(new THREE.BoxGeometry(0.6, 0.62, 0.05), toon(w.apron));
  apron.position.set(0, 0.78, 0.35);
  apron.rotation.x = -0.06;
  const bow = mesh(new THREE.BoxGeometry(0.22, 0.08, 0.05), toon(w.bow));
  bow.position.set(0, 1.38, 0.29);
  p.upper.add(apron, bow);
  setMood(p, 4);
  return p;
}

// ---------------------------------------------------------------- Props

/** A plate with a dome of food on it. */
export function makePlate(foodColor: THREE.ColorRepresentation, eaten = false): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(new THREE.CylinderGeometry(0.24, 0.2, 0.04, 18), toon(PALETTE.plate)));
  if (!eaten) {
    const food = mesh(new THREE.SphereGeometry(0.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), toon(foodColor));
    food.position.y = 0.02;
    food.scale.y = 0.75;
    g.add(food);
    const garnish = mesh(new THREE.SphereGeometry(0.035, 6, 4), toon(0x4f9d69));
    garnish.position.set(0.06, 0.12, 0.04);
    g.add(garnish);
  } else {
    const crumbs = mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.01, 10), toon(foodColor));
    crumbs.position.set(0.04, 0.025, -0.03);
    g.add(crumbs);
  }
  return g;
}

/** A glass with a coloured drink. */
export function makeGlass(color: THREE.ColorRepresentation): THREE.Group {
  const g = new THREE.Group();
  const glass = mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.26, 14), toon(0xe8f4f8, { transparent: true, opacity: 0.45 }), false);
  const liquid = mesh(new THREE.CylinderGeometry(0.085, 0.07, 0.18, 14), toon(color));
  liquid.position.y = -0.03;
  g.add(glass, liquid);
  return g;
}

/** A small round serving tray. */
export function makeTray(): THREE.Mesh {
  return mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.025, 20), toon(0x3b3f45));
}
