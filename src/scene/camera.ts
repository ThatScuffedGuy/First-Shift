import * as THREE from 'three';
import type { RestaurantLayout } from '../data/types';
import { VIEW } from '../data/view';
import { clamp } from '../game/math';

/** Screen space covered by UI, in pixels, that the room should stay clear of. */
export interface Insets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/**
 * Keeps the whole restaurant in view on any screen shape.
 *
 * The camera always looks from the same angle. On resize it searches for the
 * closest distance at which every important point (floor corners, wall tops,
 * door, labels) fits inside the part of the screen not covered by the HUD,
 * then shifts the picture so the room is centred in that space.
 */
export class CameraRig {
  readonly camera: THREE.PerspectiveCamera;
  private readonly dir: THREE.Vector3;
  private readonly points: THREE.Vector3[];
  private readonly aim: THREE.Vector3;
  private shift = { x: 0, y: 0 };
  private follow: { min: number; max: number } | null = null;
  private panX = 0;

  constructor(layout: RestaurantLayout) {
    this.camera = new THREE.PerspectiveCamera(VIEW.fov, 1, 0.1, 300);
    this.dir = new THREE.Vector3(0, VIEW.from.y, VIEW.from.z).normalize();
    this.aim = new THREE.Vector3(0, 0, VIEW.aimZ);
    this.points = keyPoints(layout);
  }

  /** True when the screen is too narrow for the whole room and the camera follows the waiter. */
  get following(): boolean {
    return this.follow !== null;
  }

  resize(width: number, height: number, insets: Insets): void {
    const cam = this.camera;
    cam.aspect = width / Math.max(1, height);
    const gap = VIEW.edgeGap;
    // The free area in normalised screen units, where -1..1 spans the full screen.
    const safe: Box = {
      x0: -1 + (2 * (insets.left + gap)) / width,
      x1: 1 - (2 * (insets.right + gap)) / width,
      y0: -1 + (2 * (insets.bottom + gap)) / height,
      y1: 1 - (2 * (insets.top + gap)) / height,
    };
    const safeW = Math.max(0.2, safe.x1 - safe.x0);
    const safeH = Math.max(0.2, safe.y1 - safe.y0);

    const fitAll = search((d) => {
      const b = this.measure(d, 0);
      return b.x1 - b.x0 <= safeW && b.y1 - b.y0 <= safeH;
    });
    const fitDepth = search((d) => {
      const b = this.measure(d, 0);
      return b.y1 - b.y0 <= safeH;
    });

    let distance = fitAll;
    this.follow = null;
    if (fitAll > fitDepth * VIEW.followWhenWidthNeeds) {
      distance = fitDepth * VIEW.followZoomOut;
      const b = this.measure(distance, 0);
      // How far the camera may slide before showing empty space past the walls.
      const max = searchUp(0, 30, (p) => this.measure(distance, p).x1 >= safe.x1);
      const min = -searchUp(0, 30, (p) => this.measure(distance, -p).x0 <= safe.x0);
      this.follow = { min, max };
      this.shift = { x: 0, y: (safe.y0 + safe.y1) / 2 - (b.y0 + b.y1) / 2 };
    } else {
      const b = this.measure(distance, 0);
      this.panX = 0;
      this.shift = { x: (safe.x0 + safe.x1) / 2 - (b.x0 + b.x1) / 2, y: (safe.y0 + safe.y1) / 2 - (b.y0 + b.y1) / 2 };
    }
    this.distance = distance;
    this.apply(this.panX);
  }

  /** Call every frame with the waiter's x position; only does something in follow mode. */
  update(dt: number, focusX: number, snap = false): void {
    if (!this.follow) return;
    const want = clamp(focusX, this.follow.min, this.follow.max);
    this.panX = snap ? want : this.panX + (want - this.panX) * Math.min(1, dt * VIEW.followRate);
    this.apply(this.panX);
  }

  private distance = 20;

  private place(d: number, panX: number): void {
    const cam = this.camera;
    const target = this.aim.clone().setX(panX);
    cam.position.copy(target).addScaledVector(this.dir, d);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    cam.updateProjectionMatrix();
  }

  /** The screen-space box around all key points with the camera at distance d. */
  private measure(d: number, panX: number): Box {
    this.place(d, panX);
    const box: Box = { x0: Infinity, x1: -Infinity, y0: Infinity, y1: -Infinity };
    const v = new THREE.Vector3();
    for (const p of this.points) {
      v.copy(p).project(this.camera);
      box.x0 = Math.min(box.x0, v.x);
      box.x1 = Math.max(box.x1, v.x);
      box.y0 = Math.min(box.y0, v.y);
      box.y1 = Math.max(box.y1, v.y);
    }
    return box;
  }

  private apply(panX: number): void {
    this.place(this.distance, panX);
    // Slide the picture on screen (like a tilt-shift lens) without changing the angle.
    const cam = this.camera;
    cam.projectionMatrix.premultiply(new THREE.Matrix4().makeTranslation(this.shift.x, this.shift.y, 0));
    cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
  }
}

/** Smallest distance in [4, 300] for which `fits` is true. */
function search(fits: (d: number) => boolean): number {
  let lo = 4, hi = 300;
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    if (fits(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Largest value in [lo, hi] for which `ok` is still true (ok must be true at lo). */
function searchUp(lo: number, hi: number, ok: (v: number) => boolean): number {
  if (!ok(lo)) return lo;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (ok(mid)) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** Points that must be visible: floor corners, wall tops, door frame and floating labels. */
function keyPoints(L: RestaurantLayout): THREE.Vector3[] {
  const hw = L.floor.width / 2, hd = L.floor.depth / 2;
  const pts = [
    new THREE.Vector3(-hw, 0, hd), new THREE.Vector3(hw, 0, hd),
    new THREE.Vector3(-hw - 0.3, L.backWallHeight, -hd - 0.3), new THREE.Vector3(hw + 0.3, L.backWallHeight, -hd - 0.3),
    new THREE.Vector3(hw + 0.3, L.sideWallHeight, hd + 0.15),
    new THREE.Vector3(-hw - 0.3, L.doorway.height + 0.15, L.doorway.minZ),
    new THREE.Vector3(-hw - 0.3, L.doorway.height + 0.15, L.doorway.maxZ),
    new THREE.Vector3(-hw - 0.3, 0, L.doorway.maxZ),
  ];
  for (const s of L.stations) {
    const top = s.labelAt.y + 0.3;
    pts.push(new THREE.Vector3(s.labelAt.x - 1.1, top, s.labelAt.z), new THREE.Vector3(s.labelAt.x + 1.1, top, s.labelAt.z));
  }
  return pts;
}
