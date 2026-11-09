import * as THREE from 'three';
import type { Point, RestaurantLayout } from '../data/types';
import { MOVEMENT } from '../data/timing';
import { STATUS } from '../data/hints';
import type { Guest } from '../game/guest';
import { byId } from '../game/guest';
import type { Shift } from '../game/shift';
import type { WaiterState, Obstacle } from '../game/waiter';
import { steerAround } from '../game/waiter';
import { distance, wrapAngle } from '../game/math';
import { animatePerson, guestLook, makeGlass, makePerson, makePlate, makeTray, setMood, type Person } from './characters';
import { bubbleTexture, makeBubble } from './bubbles';
import type { TableView } from './restaurant';

interface Figure {
  id: number;
  person: Person;
  bubble: THREE.Sprite;
  x: number;
  z: number;
  heading: number;
  speed: number;
  sitting: boolean;
  /** Set once the guest has left the shift and is walking out. */
  exit: { step: number; fade: number } | null;
  glass: THREE.Group | null;
  plate: THREE.Group | null;
  plateEaten: boolean;
}

/** Outside the door, where guests appear and disappear. */
const OUTSIDE_X = -11.6;

/**
 * Keeps the 3D guests, table items, kitchen-pass plates and the waiter's tray
 * in step with the shift. Reads game state; never changes it.
 */
export class FloorView {
  private figures = new Map<number, Figure>();
  private exiting: Figure[] = [];
  private trail: Point[] = [];
  private passPlates = new THREE.Group();
  private bell: THREE.Sprite;
  private tray = new THREE.Group();
  private trayKey = '';
  private debris: { obj: THREE.Object3D; life: number }[] = [];
  private doorZ: number;

  constructor(
    private scene: THREE.Scene,
    private layout: RestaurantLayout,
    private tables: TableView[],
    private obstacles: Obstacle[],
    waiter: Person,
  ) {
    scene.add(this.passPlates);
    this.bell = makeBubble();
    this.bell.material.map = bubbleTexture('🔔', 2, 1);
    this.bell.visible = false;
    scene.add(this.bell);
    waiter.hand.add(this.tray);
    this.doorZ = (layout.doorway.minZ + layout.doorway.maxZ) / 2;
  }

  /** Removes every guest and prop, for a new shift. */
  reset(): void {
    for (const f of [...this.figures.values(), ...this.exiting]) this.dispose(f);
    this.figures.clear();
    this.exiting = [];
    this.trail = [];
    for (const d of this.debris) this.scene.remove(d.obj);
    this.debris = [];
    this.trayKey = '';
    this.tray.clear();
  }

  update(shift: Shift, w: WaiterState, dt: number, time: number, reducedMotion: boolean): void {
    this.recordTrail(w);
    const queue = shift.doorQueue;
    for (const g of shift.guests) {
      let f = this.figures.get(g.id);
      if (!f) f = this.spawn(g);
      this.moveGuest(f, g, queue.indexOf(g), w, dt);
      this.updateTableItems(f, g, shift);
      setMood(f.person, g.mood);
      animatePerson(f.person, { dt, speed: f.speed, sitting: f.sitting, reducedMotion });
      const icon = STATUS[g.state].icon;
      f.bubble.material.map = bubbleTexture(icon, g.mood, shift.patienceLeft(g));
      const bob = reducedMotion ? 0 : Math.sin(time * 2.4 + g.id) * 0.05;
      f.bubble.position.set(f.x, (f.sitting ? 2.25 : 2.5) + bob, f.z);
    }
    this.updateExits(dt);
    this.updatePass(shift, time, reducedMotion);
    this.updateTray(shift);
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.life -= dt;
      if (d.life <= 0) {
        this.scene.remove(d.obj);
        this.debris.splice(i, 1);
      }
    }
  }

  /** A guest left the shift (paid, walked out, or reaction): they stand up and walk out. */
  guestLeft(g: Guest): void {
    const f = this.figures.get(g.id);
    if (!f) return;
    this.figures.delete(g.id);
    f.exit = { step: 0, fade: 1 };
    f.sitting = false;
    f.bubble.visible = false;
    setMood(f.person, g.mood >= 3 ? 5 : 0);
    if (f.glass) this.scene.remove(f.glass);
    if (f.plate) this.scene.remove(f.plate);
    f.glass = f.plate = null;
    this.exiting.push(f);
  }

  /** Shows a spill on the floor where the waiter is. */
  spill(kind: 'drink' | 'food', colour: string, at: Point): void {
    const g = new THREE.Group();
    const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.45, 18), new THREE.MeshBasicMaterial({ color: kind === 'drink' ? colour : '#d9c8a0', transparent: true, opacity: 0.8 }));
    puddle.rotation.x = -Math.PI / 2;
    puddle.position.y = 0.015;
    const item = kind === 'drink' ? makeGlass(colour) : makePlate(colour);
    item.rotation.z = 1.4;
    item.position.set(0.25, 0.1, 0.1);
    g.add(puddle, item);
    g.position.set(at.x + 0.3, 0, at.z + 0.3);
    this.scene.add(g);
    this.debris.push({ obj: g, life: 3 });
  }

  // ------------------------------------------------------------------

  private spawn(g: Guest): Figure {
    const person = makePerson(guestLook(g.look, g.persona.kind));
    const bubble = makeBubble();
    this.scene.add(person.root, bubble);
    const f: Figure = { id: g.id, person, bubble, x: OUTSIDE_X, z: this.doorZ, heading: Math.PI / 2, speed: 0, sitting: false, exit: null, glass: null, plate: null, plateEaten: false };
    person.root.position.set(f.x, 0, f.z);
    this.figures.set(g.id, f);
    return f;
  }

  private dispose(f: Figure): void {
    this.scene.remove(f.person.root, f.bubble);
    if (f.glass) this.scene.remove(f.glass);
    if (f.plate) this.scene.remove(f.plate);
  }

  private recordTrail(w: WaiterState): void {
    const last = this.trail[this.trail.length - 1];
    if (!last || distance(last, w) > 0.2) {
      this.trail.push({ x: w.x, z: w.z });
      if (this.trail.length > 80) this.trail.shift();
    }
  }

  /** The point on the waiter's recent path about `gap` metres behind them. */
  private behindWaiter(w: WaiterState, gap: number): Point {
    let acc = 0;
    let prev: Point = w;
    for (let i = this.trail.length - 1; i >= 0; i--) {
      const p = this.trail[i];
      acc += distance(prev, p);
      if (acc >= gap) return p;
      prev = p;
    }
    return prev;
  }

  private moveGuest(f: Figure, g: Guest, queueIndex: number, w: WaiterState, dt: number): void {
    const table = g.table ? this.tables.find((t) => t.spot.number === g.table) : undefined;
    let target: Point;
    let collide = true;
    let speed = MOVEMENT.guestSpeed;

    if (g.state === 'door') {
      const spots = this.layout.doorQueue;
      target = spots[Math.min(queueIndex, spots.length - 1)];
      collide = false;
    } else if (g.state === 'following') {
      target = this.behindWaiter(w, 1.2);
      if (distance(f, w) > 2.2) speed *= 1.7;
    } else if (table) {
      target = { x: table.seatPos.x, z: table.seatPos.z };
      if (distance(f, target) < 2.0) collide = false;
    } else {
      target = f;
    }

    if (f.sitting && table) {
      f.speed = 0;
      f.person.root.position.set(table.seatPos.x, 0.04, table.seatPos.z);
      f.person.root.rotation.y = 0;
      return;
    }

    const d = distance(f, target);
    if (d > 0.08) {
      const dir = collide ? steerAround(f, target, this.obstacles) : { x: (target.x - f.x) / d, z: (target.z - f.z) / d };
      const step = Math.min(d, speed * dt);
      f.x += dir.x * step;
      f.z += dir.z * step;
      if (collide) this.pushOut(f);
      f.speed = step / Math.max(dt, 1e-4);
      f.heading += wrapAngle(Math.atan2(dir.x, dir.z) - f.heading) * Math.min(1, dt * 10);
    } else {
      f.speed = 0;
      if (table && g.state !== 'following') f.sitting = true;
      else if (g.state === 'door') f.heading += wrapAngle(Math.PI / 2 - f.heading) * Math.min(1, dt * 6);
    }
    f.person.root.position.set(f.x, 0, f.z);
    f.person.root.rotation.y = f.heading;
  }

  private pushOut(p: Point): void {
    for (const o of this.obstacles) {
      const dx = p.x - o.x, dz = p.z - o.z;
      const d = Math.hypot(dx, dz);
      const r = o.radius - 0.35; // guests are allowed a bit closer than the waiter
      if (d < r && d > 1e-6) {
        p.x = o.x + (dx / d) * r;
        p.z = o.z + (dz / d) * r;
      }
    }
  }

  private updateExits(dt: number): void {
    for (let i = this.exiting.length - 1; i >= 0; i--) {
      const f = this.exiting[i];
      const ex = f.exit!;
      const waypoints: Point[] = [{ x: -8.6, z: this.doorZ }, { x: OUTSIDE_X, z: this.doorZ }];
      const target = waypoints[ex.step];
      const d = distance(f, target);
      if (d < 0.15) {
        ex.step++;
        if (ex.step >= waypoints.length) {
          this.dispose(f);
          this.exiting.splice(i, 1);
          continue;
        }
      } else {
        const dir = ex.step === 0 ? steerAround(f, target, this.obstacles) : { x: (target.x - f.x) / d, z: (target.z - f.z) / d };
        const step = Math.min(d, MOVEMENT.guestSpeed * dt);
        f.x += dir.x * step;
        f.z += dir.z * step;
        if (ex.step === 0) this.pushOut(f);
        f.speed = MOVEMENT.guestSpeed;
        f.heading += wrapAngle(Math.atan2(dir.x, dir.z) - f.heading) * Math.min(1, dt * 10);
      }
      f.person.root.position.set(f.x, 0, f.z);
      f.person.root.rotation.y = f.heading;
      animatePerson(f.person, { dt, speed: f.speed });
    }
  }

  private updateTableItems(f: Figure, g: Guest, shift: Shift): void {
    const table = g.table ? this.tables.find((t) => t.spot.number === g.table) : undefined;
    if (!table) return;
    if (g.hasDrink && !f.glass) {
      f.glass = makeGlass(byId(shift.menu, g.order.drinkId).color);
      f.glass.position.copy(table.glassPos);
      this.scene.add(f.glass);
    }
    const wantPlate = g.state === 'eating' || g.state === 'check';
    const eaten = g.state === 'check';
    if (wantPlate && (!f.plate || f.plateEaten !== eaten)) {
      if (f.plate) this.scene.remove(f.plate);
      f.plate = makePlate(this.foodColour(g, shift), eaten);
      f.plate.position.copy(table.platePos);
      f.plateEaten = eaten;
      this.scene.add(f.plate);
    } else if (!wantPlate && f.plate) {
      this.scene.remove(f.plate);
      f.plate = null;
    }
  }

  private foodColour(g: Guest, shift: Shift): string {
    const ids = g.ticket?.dishIds ?? g.order.dishIds;
    const main = ids.map((id) => byId(shift.menu, id)).find((m) => m.category === 'main') ?? byId(shift.menu, ids[0]);
    return main.color;
  }

  private updatePass(shift: Shift, time: number, reducedMotion: boolean): void {
    const pass = this.layout.stations.find((s) => s.kind === 'pass')!;
    const ready = shift.guests.filter((g) => g.state === 'ready').sort((a, b) => a.readyAt - b.readyAt);
    const key = ready.map((g) => g.id).join();
    if (this.passPlates.userData.key !== key) {
      this.passPlates.clear();
      ready.forEach((g, i) => {
        const p = makePlate(this.foodColour(g, shift));
        p.position.set(pass.center.x - 2 + i * 1.1, 1.12, pass.center.z + 0.2);
        p.scale.setScalar(1.35);
        this.passPlates.add(p);
      });
      this.passPlates.userData.key = key;
    }
    this.bell.visible = ready.length > 0;
    this.bell.position.set(pass.center.x, 2.3 + (reducedMotion ? 0 : Math.abs(Math.sin(time * 5)) * 0.12), pass.center.z + 0.6);
  }

  private updateTray(shift: Shift): void {
    const c = shift.carrying;
    const key = c ? `${c.kind}:${c.guestId}:${c.kind === 'drink' ? c.drinkId : ''}` : '';
    if (key === this.trayKey) return;
    this.trayKey = key;
    this.tray.clear();
    if (!c) return;
    this.tray.add(makeTray());
    const g = shift.guest(c.guestId);
    const item = c.kind === 'drink' ? makeGlass(byId(shift.menu, c.drinkId).color) : makePlate(g ? this.foodColour(g, shift) : '#d9822b');
    item.position.y = c.kind === 'drink' ? 0.14 : 0.03;
    this.tray.add(item);
  }

  /** Where a guest (or a guest walking out) is standing. */
  positionOf(guestId: number): Point | undefined {
    const f = this.figures.get(guestId) ?? this.exiting.find((x) => x.id === guestId);
    return f ? { x: f.x, z: f.z } : undefined;
  }

  /** World position above a table, the door or a station, for the tutorial pointer. */
  tablePoint(n: number): Point | undefined {
    const t = this.tables.find((x) => x.spot.number === n);
    return t ? { x: t.spot.x, z: t.spot.z } : undefined;
  }
}
