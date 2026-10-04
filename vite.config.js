import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' lets the built game work from any folder or from GitHub Pages
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    chunkSizeWarningLimit: 1500,
    // two games: the candy adventure (index.html) and Esmae's princess kitchen (princess.html)
    rollupOptions: { input: { main: resolve(import.meta.dirname, 'index.html'), princess: resolve(import.meta.dirname, 'princess.html') } },
  },
});
