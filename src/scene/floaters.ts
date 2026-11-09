import * as THREE from 'three';
import { canvasTexture } from './materials';

/** Little text pop-ups ("−1", "+$3.96") that float up from a guest and fade. */
export class Floaters {
  private items: { sprite: THREE.Sprite; life: number }[] = [];

  constructor(private scene: THREE.Scene) {}

  show(text: string, colour: string, x: number, z: number, y = 3.3): void {
    const map = canvasTexture(256, 96, (c) => {
      c.font = '800 54px "Bricolage Grotesque Variable", sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.lineWidth = 10;
      c.strokeStyle = 'rgba(20,24,30,.85)';
      c.strokeText(text, 128, 50);
      c.fillStyle = colour;
      c.fillText(text, 128, 50);
    });
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map, depthTest: false, transparent: true }));
    sprite.scale.set(2.2, 0.82, 1);
    sprite.position.set(x, y, z);
    sprite.renderOrder = 11;
    this.scene.add(sprite);
    this.items.push({ sprite, life: 1.6 });
  }

  update(dt: number): void {
    for (let i = this.items.length - 1; i >= 0; i--) {
      const f = this.items[i];
      f.life -= dt;
      f.sprite.position.y += dt * 0.7;
      f.sprite.material.opacity = Math.min(1, f.life / 0.6);
      if (f.life <= 0) {
        this.scene.remove(f.sprite);
        f.sprite.material.map?.dispose();
        f.sprite.material.dispose();
        this.items.splice(i, 1);
      }
    }
  }
}
