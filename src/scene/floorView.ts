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

/** One person in a party. */
interface Member {
  person: Person;
  x: number;
  z: number;
  heading: number;
  speed: number;
  sitting: boolean;
  glass: THREE.Group | null;
  plate: THREE.Group | null;
  plateEaten: boolean;
}

/** A guest or a group of guests (member 0 is the host, who talks and wears the bubble). */
interface Party {
  id: number;
  members: Member[];
  bubble: THREE.Sprite;
  /** Set once they've left the shift and are walking out. */
  exit: { step: number } | null;
}

/** Outside the door, where guests appear and disappear. */
const OUTSIDE_X = -11.6;

/**
 * Keeps the 3D guests, table items, kitchen-pass plates and the waiter's tray
 * in step with the shift. Reads game state; never changes it.
 */
export class FloorView {
  private parties = new Map<number, Party>();
  private exiting: Party[] = [];
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
    for (const p of [...this.parties.values(), ...this.exiting]) this.dispose(p);
    this.parties.clear();
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
      const party = this.parties.get(g.id) ?? this.spawn(g);
      party.members.forEach((m, i) => {
        this.moveMember(m, i, g, queue.indexOf(g), w, dt);
        setMood(m.person, g.mood);
        animatePerson(m.person, { dt, speed: m.speed, sitting: m.sitting, reducedMotion });
      });
      this.updateTableItems(party, g, shift);
      const host = party.members[0];
      party.bubble.material.map = bubbleTexture(STATUS[g.state].icon, g.mood, shift.patienceLeft(g));
      const bob = reducedMotion ? 0 : Math.sin(time * 2.4 + g.id) * 0.05;
      party.bubble.position.set(host.x, (host.sitting ? 2.25 : 2.5) + bob, host.z);
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

  /** A guest or group left the shift (paid, walked out, or a reaction): they stand up and walk out. */
  guestLeft(g: Guest): void {
    const p = this.parties.get(g.id);
    if (!p) return;
    this.parties.delete(g.id);
    p.exit = { step: 0 };
    p.bubble.visible = false;
    for (const m of p.members) {
      m.sitting = false;
      setMood(m.person, g.mood >= 3 ? 5 : 0);
      this.clearItems(m);
    }
    this.exiting.push(p);
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

  /** Where a guest's host (or a host walking out) is standing. */
  positionOf(guestId: number): Point | undefined {
    const p = this.parties.get(guestId) ?? this.exiting.find((x) => x.id === guestId);
    return p ? { x: p.members[0].x, z: p.members[0].z } : undefined;
  }

  /** World position of a table centre, for the tutorial pointer. */
  tablePoint(n: number): Point | undefined {
    const t = this.tables.find((x) => x.spot.number === n);
    return t ? { x: t.spot.x, z: t.spot.z } : undefined;
  }

  // ------------------------------------------------------------------

  private spawn(g: Guest): Party {
    const members: Member[] = Array.from({ length: g.size }, (_, i) => {
      const person = makePerson(guestLook(g.look + i * 7919, g.persona.kind));
      this.scene.add(person.root);
      const m: Member = { person, x: OUTSIDE_X - i * 0.7, z: this.doorZ, heading: Math.PI / 2, speed: 0, sitting: false, glass: null, plate: null, plateEaten: false };
      person.root.position.set(m.x, 0, m.z);
      return m;
    });
    const bubble = makeBubble();
    this.scene.add(bubble);
    const party: Party = { id: g.id, members, bubble, exit: null };
    this.parties.set(g.id, party);
    return party;
  }

  private clearItems(m: Member): void {
    if (m.glass) this.scene.remove(m.glass);
    if (m.plate) this.scene.remove(m.plate);
    m.glass = m.plate = null;
  }

  private dispose(p: Party): void {
    this.scene.remove(p.bubble);
    for (const m of p.members) {
      this.scene.remove(m.person.root);
      this.clearItems(m);
    }
  }

  private recordTrail(w: WaiterState): void {
    const last = this.trail[this.trail.length - 1];
    if (!last || distance(last, w) > 0.2) {
      this.trail.push({ x: w.x, z: w.z });
      if (this.trail.length > 120) this.trail.shift();
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

  private moveMember(m: Member, i: number, g: Guest, queueIndex: number, w: WaiterState, dt: number): void {
    const table = g.table ? this.tables.find((t) => t.spot.number === g.table) : undefined;
    const seat = table?.seats[i];
    let target: Point;
    let collide = true;
    let speed = MOVEMENT.guestSpeed;

    if (g.state === 'door') {
      const spots = this.layout.doorQueue;
      const spot = spots[Math.min(queueIndex, spots.length - 1)];
      // Group members stand in a little cluster around the queue spot.
      target = { x: spot.x + [0, 0.55, 0.55, 1.1][i], z: spot.z + [0, -0.4, 0.4, 0][i] };
      collide = false;
    } else if (g.state === 'following') {
      target = this.behindWaiter(w, 1.2 + i * 0.9);
      if (distance(m, w) > 2.2 + i * 0.9) speed *= 1.7;
    } else if (seat) {
      target = { x: seat.pos.x, z: seat.pos.z };
      if (distance(m, target) < 2.0) collide = false;
    } else {
      target = m;
    }

    if (m.sitting && seat) {
      m.speed = 0;
      m.person.root.position.copy(seat.pos);
      m.person.root.rotation.y = seat.heading;
      return;
    }

    const d = distance(m, target);
    if (d > 0.08) {
      const dir = collide ? steerAround(m, target, this.obstacles) : { x: (target.x - m.x) / d, z: (target.z - m.z) / d };
      const step = Math.min(d, speed * dt);
      m.x += dir.x * step;
      m.z += dir.z * step;
      if (collide) this.pushOut(m);
      m.speed = step / Math.max(dt, 1e-4);
      m.heading += wrapAngle(Math.atan2(dir.x, dir.z) - m.heading) * Math.min(1, dt * 10);
    } else {
      m.speed = 0;
      if (seat && g.state !== 'following') m.sitting = true;
      else if (g.state === 'door') m.heading += wrapAngle(Math.PI / 2 - m.heading) * Math.min(1, dt * 6);
    }
    m.person.root.position.set(m.x, 0, m.z);
    m.person.root.rotation.y = m.heading;
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
    const waypoints: Point[] = [{ x: -8.6, z: this.doorZ }, { x: OUTSIDE_X - 1, z: this.doorZ }];
    for (let i = this.exiting.length - 1; i >= 0; i--) {
      const p = this.exiting[i];
      const ex = p.exit!;
      let allOut = true;
      p.members.forEach((m, k) => {
        // Members leave one after another, a little apart.
        const step = Math.min(ex.step, waypoints.length - 1);
        const target = waypoints[step];
        const d = distance(m, target);
        if (step === waypoints.length - 1 && d < 0.2) return;
        allOut = false;
        if (d < 0.15) return;
        const lag = k * 0.35;
        const dir = step === 0 ? steerAround(m, target, this.obstacles) : { x: (target.x - m.x) / d, z: (target.z - m.z) / d };
        const move = Math.min(d, MOVEMENT.guestSpeed * dt * (1 - lag * 0.3));
        m.x += dir.x * move;
        m.z += dir.z * move;
        if (step === 0) this.pushOut(m);
        m.speed = MOVEMENT.guestSpeed;
        m.heading += wrapAngle(Math.atan2(dir.x, dir.z) - m.heading) * Math.min(1, dt * 10);
        m.person.root.position.set(m.x, 0, m.z);
        m.person.root.rotation.y = m.heading;
        animatePerson(m.person, { dt, speed: m.speed });
      });
      // Move everyone on to the next waypoint once the host reaches this one.
      if (ex.step === 0 && distance(p.members[0], waypoints[0]) < 0.3) ex.step = 1;
      if (allOut && ex.step === 1) {
        this.dispose(p);
        this.exiting.splice(i, 1);
      }
    }
  }

  private updateTableItems(p: Party, g: Guest, shift: Shift): void {
    const table = g.table ? this.tables.find((t) => t.spot.number === g.table) : undefined;
    if (!table) return;
    const wantPlate = g.state === 'eating' || g.state === 'check';
    const eaten = g.state === 'check';
    const dishes = this.dishColours(g, shift);
    p.members.forEach((m, i) => {
      const seat = table.seats[i];
      const drinkId = g.order.drinkIds[i] ?? g.order.drinkIds[0];
      if (g.servedDrinks.includes(drinkId) && !m.glass) {
        m.glass = makeGlass(byId(shift.menu, drinkId).color);
        m.glass.position.copy(seat.glass);
        this.scene.add(m.glass);
      }
      if (wantPlate && (!m.plate || m.plateEaten !== eaten)) {
        if (m.plate) this.scene.remove(m.plate);
        m.plate = makePlate(dishes[i % dishes.length], eaten);
        m.plate.position.copy(seat.plate);
        m.plateEaten = eaten;
        this.scene.add(m.plate);
      } else if (!wantPlate && m.plate) {
        this.scene.remove(m.plate);
        m.plate = null;
      }
    });
  }

  /** Colours of the main dishes on the guest's ticket (what the kitchen actually made). */
  private dishColours(g: Guest, shift: Shift): string[] {
    const ids = g.ticket?.dishIds ?? g.order.dishIds;
    const items = ids.map((id) => byId(shift.menu, id));
    const mains = items.filter((m) => m.category === 'main');
    return (mains.length ? mains : items).map((m) => m.color);
  }

  private updatePass(shift: Shift, time: number, reducedMotion: boolean): void {
    const pass = this.layout.stations.find((s) => s.kind === 'pass')!;
    const ready = shift.guests.filter((g) => g.state === 'ready').sort((a, b) => a.readyAt - b.readyAt);
    const key = ready.map((g) => g.id).join();
    if (this.passPlates.userData.key !== key) {
      this.passPlates.clear();
      let slot = 0;
      for (const g of ready) {
        for (const colour of this.dishColours(g, shift).slice(0, g.size)) {
          const p = makePlate(colour);
          p.position.set(pass.center.x - 2.3 + slot * 0.75, 1.12, pass.center.z + 0.2);
          p.scale.setScalar(1.2);
          this.passPlates.add(p);
          slot++;
        }
      }
      this.passPlates.userData.key = key;
    }
    this.bell.visible = ready.length > 0;
    this.bell.position.set(pass.center.x, 2.3 + (reducedMotion ? 0 : Math.abs(Math.sin(time * 5)) * 0.12), pass.center.z + 0.6);
  }

  private updateTray(shift: Shift): void {
    const c = shift.carrying;
    const key = c ? `${c.kind}:${c.guestId}:${c.kind === 'drink' ? c.drinkIds.join() : ''}` : '';
    if (key === this.trayKey) return;
    this.trayKey = key;
    this.tray.clear();
    if (!c) return;
    this.tray.add(makeTray());
    const g = shift.guest(c.guestId);
    const colours = c.kind === 'drink' ? c.drinkIds.map((id) => byId(shift.menu, id).color) : g ? this.dishColours(g, shift).slice(0, g.size) : ['#d9822b'];
    const n = colours.length;
    colours.forEach((colour, i) => {
      const item = c.kind === 'drink' ? makeGlass(colour) : makePlate(colour);
      const a = (i / n) * Math.PI * 2;
      const r = n > 1 ? (c.kind === 'drink' ? 0.14 : 0.16) : 0;
      item.position.set(Math.cos(a) * r, c.kind === 'drink' ? 0.14 : 0.03 + i * 0.05, Math.sin(a) * r);
      if (c.kind === 'food' && n > 1) item.scale.setScalar(0.7);
      this.tray.add(item);
    });
  }
}
