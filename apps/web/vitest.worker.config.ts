import { defineConfig } from 'vitest/config';

/** Unit tests of the Cloudflare Worker, which runs outside of Angular. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['worker/**/*.spec.ts'],
  },
});
