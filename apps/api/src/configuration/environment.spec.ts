import { environmentSchema, parseEnvironment } from './environment.js';

describe('environmentSchema', () => {
  it('defaults the cache size and the French station details time budget', () => {
    const environment = environmentSchema.parse({});

    expect(environment.CACHE_MAXIMUM_ENTRIES).toBe(5000);
    expect(environment.FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS).toBe(3000);
  });

  it.each([
    'FRANCE_FUEL_PRICES_BASE_URL',
    'FRANCE_STATION_DETAILS_BASE_URL',
    'PHOTON_BASE_URL',
  ] as const)('drops trailing slashes from %s', variable => {
    const environment = environmentSchema.parse({ [variable]: 'https://example.org/base//' });

    expect(environment[variable]).toBe('https://example.org/base');
  });
});

describe('parseEnvironment', () => {
  it('names every invalid variable', () => {
    expect(() => parseEnvironment({ PORT: 'eighty', CACHE_MAXIMUM_ENTRIES: '0' })).toThrow(
      /^Config validation error: PORT: .+\nCACHE_MAXIMUM_ENTRIES: .+$/
    );
  });

  it('ignores variables it does not know', () => {
    expect(parseEnvironment({ HOME: '/home/node' })).toEqual(environmentSchema.parse({}));
  });
});
