/// <reference types="vitest/config" />
import { defineConfig } from 'vite';

// base './' makes the built game use relative paths, so the dist/ folder can be
// opened from anywhere, including inside a desktop wrapper (Tauri/Electron) later.
export default defineConfig({
  base: './',
  server: { host: true },
  // Three.js alone is about 520 kB, so the default 500 kB warning would always fire.
  build: { chunkSizeWarningLimit: 900 },
  test: {
    include: ['tests/**/*.test.ts'],
    passWithNoTests: true,
  },
});
