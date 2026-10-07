import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { VitePWA } from 'vite-plugin-pwa';

const page = (name) => resolve(import.meta.dirname, name);

// base './' lets the built game work from any folder or from GitHub Pages
export default defineConfig({
  base: './',
  server: { host: true, port: 5173 },
  build: {
    chunkSizeWarningLimit: 1500,
    // index.html is the games menu; each game is its own page (candy.html, princess.html, ...)
    rollupOptions: { input: { hub: page('index.html'), candy: page('candy.html'), princess: page('princess.html'), uni: page('uni.html'), mermaid: page('mermaid.html'), derby: page('derby.html'), progress: page('progress.html'), stickers: page('stickers.html') } },
  },
  plugins: [
    // Offline: a Workbox service worker precaches every page, script, model, texture, sound and font,
    // so after one visit the home-screen app works in airplane mode. It updates itself quietly when a new version is published.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['icon-ae-192.png', 'icon-ae-512.png', 'apple-touch-icon-ae.png'],
      manifest: {
        name: 'A&E Games', short_name: 'A&E Games', description: 'Games for Adalyn and Esmae.',
        start_url: './', scope: './', display: 'fullscreen', orientation: 'landscape',
        background_color: '#7fd8ff', theme_color: '#7fd8ff',
        icons: [
          { src: 'icon-ae-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-ae-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-ae-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,woff2,png,jpg,webp,glb,gltf,bin,hdr,json,mp3}'],
        globIgnores: ['**/*.bvh'],
        maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/\/jackson\//],   // Jackson's game is its own page, not part of the A&E hub
        cleanupOutdatedCaches: true,
        skipWaiting: true, clientsClaim: true,     // a new version takes over on the next launch, not the one after (script-defer registration skips autoUpdate's wiring)
        importScripts: ['sw-cleanup.js'],          // removes the caches of the old hand-written service worker
      },
    }),
  ],
});
