import { describe, expect, it } from 'vitest';
import { apiErrorSchema } from './index.js';

describe('apiErrorSchema', () => {
  it('accepts the error body returned by the API', () => {
    expect(
      apiErrorSchema.parse({ statusCode: 502, message: 'The fuel price service is unavailable.' })
    ).toEqual({ statusCode: 502, message: 'The fuel price service is unavailable.' });
  });
});
