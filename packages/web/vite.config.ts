import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

// Base path: served at root by default; override with VITE_BASE for subpath deploys
// (e.g. GitHub Pages project sites at /<repo>/).
const base = process.env['VITE_BASE'] ?? '/';

export default defineConfig({
  base,
  plugins: [vue()],
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/lib/**/*.ts', 'src/stores/**/*.ts', 'src/schemas.ts'],
      exclude: ['src/**/*.test.ts'],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 80,
        statements: 90,
      },
    },
  },
});
