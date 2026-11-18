import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  retries: 0,
  use: {
    locale: 'es-ES',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      // Flujos funcionales contra el servidor de desarrollo (con proxy /api simulado en los tests).
      name: 'mobile-chrome',
      testIgnore: /pwa\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:5173' },
    },
    {
      // PWA, offline y rendimiento contra el build de producción (service worker real).
      name: 'pwa',
      testMatch: /pwa\.spec\.ts/,
      use: { ...devices['Pixel 7'], baseURL: 'http://localhost:4173' },
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: 'npm run build && npx vite preview --port 4173 --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
});
