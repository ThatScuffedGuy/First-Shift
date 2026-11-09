import * as THREE from 'three';

/**
 * The prototype used Three.js r128, which treated colour codes as already
 * "linear". Newer Three.js converts them first, which would make every colour
 * darker and moodier. Turning the conversion off keeps the prototype's bright,
 * cartoony palette with the same colour codes.
 */
THREE.ColorManagement.enabled = false;

/**
 * Newer Three.js measures light in physical units, which are dimmer by a
 * factor of pi than the old units. Multiply by this to keep the prototype's brightness.
 */
export const LEGACY_LIGHT = Math.PI;

export function createRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  return renderer;
}
