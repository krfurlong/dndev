import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  server: {
    watch: {
      ignored: /(?:^|[\\/])(?:\.cache|\.pnpm-store|test-results|playwright-report)(?:[\\/]|$)/,
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'DnDev — Campaign Sheets',
        short_name: 'DnDev',
        description: 'Your character, every chapter.',
        theme_color: '#2563eb',
        background_color: '#f5f7fb',
        display: 'standalone',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,json}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [],
      },
    }),
  ],
  test: { environment: 'node', include: ['tests/**/*.test.ts'], restoreMocks: true },
});
