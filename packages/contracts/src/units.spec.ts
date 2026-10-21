import { describe, expect, it } from 'vitest';
import { METERS_PER_KILOMETER } from './index.js';

describe('METERS_PER_KILOMETER', () => {
  it('is 1000', () => {
    expect(METERS_PER_KILOMETER).toBe(1000);
  });
});
