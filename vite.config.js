import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// base './' lets the built game work from any folder or from GitHub Pages
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    chunkSizeWarningLimit: 1500,
    // index.html is the games menu; each game is its own page (candy.html, princess.html, ...)
    rollupOptions: { input: { hub: resolve(import.meta.dirname, 'index.html'), candy: resolve(import.meta.dirname, 'candy.html'), princess: resolve(import.meta.dirname, 'princess.html'), uni: resolve(import.meta.dirname, 'uni.html'), mermaid: resolve(import.meta.dirname, 'mermaid.html'), derby: resolve(import.meta.dirname, 'derby.html') } },
  },
});
