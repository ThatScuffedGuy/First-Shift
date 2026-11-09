import * as THREE from 'three';

/** A ring on the floor showing where a tap will walk to. Fades out when you arrive. */
export class TapMarker {
  readonly object: THREE.Mesh;
  private material: THREE.MeshBasicMaterial;
  private age = 0;

  constructor() {
    this.material = new THREE.MeshBasicMaterial({ color: 0xfbf7ea, transparent: true, opacity: 0, depthWrite: false });
    this.object = new THREE.Mesh(new THREE.RingGeometry(0.22, 0.32, 32), this.material);
    this.object.rotation.x = -Math.PI / 2;
    this.object.position.y = 0.02;
    this.object.visible = false;
  }

  show(x: number, z: number): void {
    this.object.position.set(x, 0.02, z);
    this.object.visible = true;
    this.age = 0;
  }

  /** active: whether the waiter is still walking to the marker. */
  update(dt: number, active: boolean): void {
    if (!this.object.visible) return;
    this.age += dt;
    const pulse = 1 + Math.sin(this.age * 8) * 0.08;
    this.object.scale.setScalar(pulse);
    const target = active ? 0.85 : 0;
    this.material.opacity += (target - this.material.opacity) * Math.min(1, dt * 10);
    if (!active && this.material.opacity < 0.02) this.object.visible = false;
  }
}
