import { defineConfig } from 'vitest/config';

/** Unit tests of the Cloudflare Pages Functions, which run outside of Angular. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['functions/**/*.spec.ts'],
  },
});
