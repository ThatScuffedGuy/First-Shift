import * as THREE from 'three';
import { canvasTexture } from './materials';

/** Mood 0..5 as a ring colour: red, amber, grey, green. */
export const moodColour = (mood: number): string => (mood >= 4 ? '#2f9a6b' : mood === 3 ? '#8892a6' : mood === 2 ? '#d99a1b' : '#d2402f');

/** Pale tint of the bubble itself, so a glance shows who's unhappy. */
const moodFill = (mood: number): string => (mood >= 4 ? '#effaf3' : mood === 3 ? '#fffdf6' : mood === 2 ? '#fff4dc' : '#ffe4e0');

const cache = new Map<string, THREE.Texture>();

/**
 * A speech bubble with an emoji and a ring that empties as patience runs out.
 * Textures are cached in 12 steps so they're cheap to update every frame.
 */
export function bubbleTexture(icon: string, mood: number, patience: number): THREE.Texture {
  const step = Math.round(Math.max(0, Math.min(1, patience)) * 12);
  const key = `${icon}|${mood}|${step}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const tex = canvasTexture(128, 128, (x) => {
    x.fillStyle = moodFill(mood);
    x.beginPath();
    x.arc(64, 56, 46, 0, Math.PI * 2);
    x.fill();
    x.beginPath();
    x.moveTo(50, 94);
    x.lineTo(64, 124);
    x.lineTo(78, 94);
    x.fill();
    x.lineWidth = 9;
    x.strokeStyle = '#d9d2c2';
    x.beginPath();
    x.arc(64, 56, 46, 0, Math.PI * 2);
    x.stroke();
    if (step > 0) {
      x.strokeStyle = moodColour(mood);
      x.lineCap = 'round';
      x.beginPath();
      x.arc(64, 56, 46, -Math.PI / 2, -Math.PI / 2 + (Math.PI * 2 * step) / 12);
      x.stroke();
    }
    x.font = '50px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(icon, 64, 60);
  });
  cache.set(key, tex);
  return tex;
}

export function makeBubble(): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
  s.renderOrder = 10;
  s.scale.setScalar(0.95);
  return s;
}
