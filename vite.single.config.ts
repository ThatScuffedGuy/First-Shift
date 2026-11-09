import { defineConfig, mergeConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';
import base from './vite.config';

/**
 * Builds the whole game (code, styles and fonts) into ONE html file that can be
 * opened with a double-click, no install or server needed.
 * Run with: npm run build:file  ->  play/First-Shift.html
 */
export default mergeConfig(
  base,
  defineConfig({
    plugins: [viteSingleFile()],
    build: { outDir: 'play', emptyOutDir: true },
  }),
);
