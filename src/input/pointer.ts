import * as THREE from 'three';
import type { Point } from '../data/types';

/**
 * Turns a tap or click on the 3D view into a point on the floor.
 * Works the same for mouse, touch and pen.
 */
export function onFloorTap(canvas: HTMLCanvasElement, camera: THREE.Camera, enabled: () => boolean, handler: (p: Point) => void): void {
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hit = new THREE.Vector3();
  canvas.addEventListener('pointerdown', (e) => {
    if (!enabled() || !e.isPrimary || e.button > 0) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    if (ray.ray.intersectPlane(floor, hit)) handler({ x: hit.x, z: hit.z });
  });
}
