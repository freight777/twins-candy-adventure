import { defineConfig } from 'vite';

// base './' lets the built game work from any folder or from GitHub Pages
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: { chunkSizeWarningLimit: 1500 },
});
