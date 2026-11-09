import * as THREE from 'three';
import { canvasTexture } from './materials';
import { PALETTE } from './palette';

const UI_FONT = '"Bricolage Grotesque Variable", ui-sans-serif, system-ui, sans-serif';

/** A rounded name tag that always faces the camera and draws on top of the scene. */
export function makeLabel(text: string): THREE.Sprite {
  const map = canvasTexture(256, 64, (c) => {
    c.fillStyle = PALETTE.labelBg;
    c.beginPath();
    c.roundRect(4, 6, 248, 52, 26);
    c.fill();
    c.fillStyle = PALETTE.labelInk;
    c.font = `700 30px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(text, 128, 34);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  s.scale.set(2.2, 0.55, 1);
  s.renderOrder = 9;
  return s;
}

/** The small round table-number badge on the floor next to each table. */
export function makeNumberBadge(n: number): THREE.Sprite {
  const map = canvasTexture(64, 64, (c) => {
    c.fillStyle = PALETTE.labelBg;
    c.beginPath();
    c.arc(32, 32, 28, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = PALETTE.labelInk;
    c.font = `800 34px ${UI_FONT}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(String(n), 32, 34);
  });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false }));
  s.scale.setScalar(0.5);
  return s;
}

/** Redraws a sprite's texture, e.g. once the web fonts have loaded. */
export function replaceSpriteTexture(sprite: THREE.Sprite, next: THREE.Sprite): void {
  sprite.material.map?.dispose();
  sprite.material.map = next.material.map;
  sprite.material.needsUpdate = true;
}
