import { describe, expect, it } from 'vitest';
import { METERS_PER_KILOMETER, MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from './index.js';

describe('units', () => {
  it('has 1000 meters per kilometer', () => {
    expect(METERS_PER_KILOMETER).toBe(1000);
  });

  it('has 1000 milliseconds per second and 60000 per minute', () => {
    expect(MILLISECONDS_PER_SECOND).toBe(1000);
    expect(MILLISECONDS_PER_MINUTE).toBe(60_000);
  });
});
