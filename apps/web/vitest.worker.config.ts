import { defineConfig } from 'vitest/config';

/** Unit tests of the Cloudflare Worker and the hosting build, which run outside of Angular. */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['worker/**/*.spec.ts', 'hosting/**/*.spec.ts'],
  },
});
