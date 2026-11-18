/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { apiDevPlugin } from './vite-plugins/api-dev.ts';

export default defineConfig(({ isSsrBuild }) => ({
  plugins: [
    react(),
    tailwindcss(),
    apiDevPlugin(),
    // El build SSR (solo para prerenderizar la bienvenida) no genera service worker.
    !isSsrBuild &&
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon-180.png'],
      manifest: {
        name: 'ErasmusEats',
        short_name: 'ErasmusEats',
        description: 'Come barato y cumple tu objetivo, estés donde estés.',
        lang: 'es',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#17664f',
        background_color: '#f6f6f3',
        categories: ['health', 'food', 'lifestyle'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Toda la app (incluidas las pantallas diferidas, recetas y precios) queda en caché: funciona offline.
        globPatterns: ['**/*.{js,css,html,svg,png,json,webmanifest}'],
        navigateFallback: '/index.html',
        // El proxy nunca se sirve desde el service worker (las búsquedas se cachean en IndexedDB).
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [{ urlPattern: /\/api\//, handler: 'NetworkOnly' }],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'api/**/*.test.ts'],
  },
}));
