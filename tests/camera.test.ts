import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { CameraRig } from '../src/scene/camera';
import { HOUSE_LAYOUT as L } from '../src/data/layout';

const insets = { top: 60, bottom: 0, left: 0, right: 0 };

/** Where a floor point lands on screen, in pixels from the top-left. */
function toScreen(rig: CameraRig, x: number, y: number, z: number, w: number, h: number) {
  const v = new THREE.Vector3(x, y, z).project(rig.camera);
  return { px: ((v.x + 1) / 2) * w, py: ((1 - v.y) / 2) * h };
}

describe('camera fitting', () => {
  for (const [w, h] of [[1280, 800], [1920, 1080], [1024, 768], [2560, 1080]]) {
    it(`shows the whole room below the top bar at ${w}x${h}`, () => {
      const rig = new CameraRig(L);
      rig.resize(w, h, insets);
      expect(rig.following).toBe(false);
      const hw = L.floor.width / 2, hd = L.floor.depth / 2;
      for (const [x, y, z] of [[-hw - 0.3, 0, L.doorway.maxZ], [hw, 0, hd], [-hw, L.backWallHeight, -hd], [hw, L.backWallHeight, -hd]]) {
        const p = toScreen(rig, x, y, z, w, h);
        expect(p.px).toBeGreaterThanOrEqual(0);
        expect(p.px).toBeLessThanOrEqual(w);
        expect(p.py).toBeGreaterThanOrEqual(insets.top);
        expect(p.py).toBeLessThanOrEqual(h);
      }
    });
  }

  it('follows the waiter on a phone held upright, and can reach the door', () => {
    const [w, h] = [390, 844];
    const rig = new CameraRig(L);
    rig.resize(w, h, insets);
    expect(rig.following).toBe(true);
    rig.update(0, L.stations.find((s) => s.kind === 'door')!.center.x, true);
    const door = toScreen(rig, -L.floor.width / 2, 0, L.doorway.maxZ, w, h);
    expect(door.px).toBeGreaterThanOrEqual(0);
    expect(door.px).toBeLessThan(w / 2);
  });
});
