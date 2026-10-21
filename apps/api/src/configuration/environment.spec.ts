import { environmentSchema } from './environment.js';

describe('environmentSchema', () => {
  it('defaults the cache size', () => {
    const environment = environmentSchema.parse({});

    expect(environment.CACHE_MAXIMUM_ENTRIES).toBe(5000);
  });

  it.each([
    'FRANCE_FUEL_PRICES_BASE_URL',
    'FRANCE_STATION_DETAILS_BASE_URL',
    'TANKENTANKEN_BASE_URL',
    'PHOTON_BASE_URL',
  ] as const)('drops trailing slashes from %s', variable => {
    const environment = environmentSchema.parse({ [variable]: 'https://example.org/base//' });

    expect(environment[variable]).toBe('https://example.org/base');
  });
});
