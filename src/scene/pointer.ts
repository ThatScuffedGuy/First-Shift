import * as THREE from 'three';
import type { Point } from '../data/types';

/** A bobbing arrow that points at where the tutorial wants you to go. */
export class Pointer {
  readonly object = new THREE.Group();

  constructor() {
    // Unlit, so it stays bright red whatever the lighting.
    const mat = new THREE.MeshBasicMaterial({ color: 0xe8402f });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 16), mat);
    head.rotation.x = Math.PI;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.5, 10), mat);
    shaft.position.y = 0.5;
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.55, 0.7, 32), new THREE.MeshBasicMaterial({ color: 0xc23b2e, transparent: true, opacity: 0.55, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.name = 'ring';
    this.object.add(head, shaft);
    this.object.userData.ring = ring;
    this.object.visible = false;
  }

  /** Ring on the floor; add it to the scene separately so it stays flat. */
  get ring(): THREE.Mesh {
    return this.object.userData.ring;
  }

  show(at: Point | null, height = 2.9): void {
    this.object.visible = this.ring.visible = !!at;
    if (!at) return;
    this.object.userData.base = height;
    this.object.position.set(at.x, height, at.z);
    this.ring.position.set(at.x, 0.03, at.z);
  }

  update(time: number, reducedMotion: boolean): void {
    if (!this.object.visible) return;
    this.object.position.y = this.object.userData.base + (reducedMotion ? 0 : Math.abs(Math.sin(time * 3.2)) * 0.25);
    this.ring.scale.setScalar(1 + (reducedMotion ? 0 : Math.sin(time * 4) * 0.08));
  }
}
