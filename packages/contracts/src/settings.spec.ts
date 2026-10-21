import { describe, expect, it } from 'vitest';
import { colorSchemePreferenceSchema } from './index.js';

describe('colorSchemePreferenceSchema', () => {
  it.each(['system', 'light', 'dark'])('accepts %s', preference => {
    expect(colorSchemePreferenceSchema.parse(preference)).toBe(preference);
  });

  it('rejects unknown preferences', () => {
    expect(colorSchemePreferenceSchema.safeParse('sepia').success).toBe(false);
  });
});
