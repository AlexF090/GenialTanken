import { environmentSchema, parseEnvironment } from './environment.js';

describe('environmentSchema', () => {
  it('defaults the cache size and the French station details time budget', () => {
    const environment = environmentSchema.parse({});

    expect(environment.CACHE_MAXIMUM_ENTRIES).toBe(5000);
    expect(environment.FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS).toBe(3000);
  });

  it('defaults the French price snapshot to a 10 minute refresh, an hour of maximum age and a 30 second timeout', () => {
    const environment = environmentSchema.parse({});

    expect(environment.FRANCE_PRICE_SNAPSHOT_REFRESH_INTERVAL_IN_SECONDS).toBe(600);
    expect(environment.FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS).toBe(3600);
    expect(environment.FRANCE_PRICE_SNAPSHOT_TIMEOUT_IN_SECONDS).toBe(30);
  });

  it.each(['3600', '7200'])(
    'rejects a French price snapshot refresh interval of %s seconds, not shorter than the maximum age',
    interval => {
      expect(() =>
        parseEnvironment({ FRANCE_PRICE_SNAPSHOT_REFRESH_INTERVAL_IN_SECONDS: interval })
      ).toThrow(
        'Configuration validation error: FRANCE_PRICE_SNAPSHOT_REFRESH_INTERVAL_IN_SECONDS: must be shorter than FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS'
      );
    }
  );

  it.each([
    'FRANCE_FUEL_PRICES_BASE_URL',
    'FRANCE_STATION_DETAILS_BASE_URL',
    'PHOTON_BASE_URL',
  ] as const)('drops trailing slashes from %s', variable => {
    const environment = environmentSchema.parse({ [variable]: 'https://example.org/base//' });

    expect(environment[variable]).toBe('https://example.org/base');
  });
});

describe('durations', () => {
  it.each([
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', '2147483647'],
    ['FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS', '2147483647'],
    ['CACHE_TIME_TO_LIVE_IN_SECONDS', '2147483'],
    ['FRANCE_STATION_DETAILS_CACHE_TIME_TO_LIVE_IN_SECONDS', '2147483'],
    ['PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS', '2147483'],
    ['FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS', '2147483'],
    ['FRANCE_PRICE_SNAPSHOT_TIMEOUT_IN_SECONDS', '2147483'],
  ])('accepts %s up to the longest timer delay of Node.js', (variable, value) => {
    expect(environmentSchema.safeParse({ [variable]: value }).success).toBe(true);
  });

  it.each([
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', '2147483648'],
    ['FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS', '2147483648'],
    ['CACHE_TIME_TO_LIVE_IN_SECONDS', '2147484'],
    ['FRANCE_STATION_DETAILS_CACHE_TIME_TO_LIVE_IN_SECONDS', '2147484'],
    ['PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS', '2147484'],
    ['FRANCE_PRICE_SNAPSHOT_REFRESH_INTERVAL_IN_SECONDS', '2147484'],
    ['FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS', '2147484'],
    ['FRANCE_PRICE_SNAPSHOT_TIMEOUT_IN_SECONDS', '2147484'],
  ])('rejects %s beyond the longest timer delay of Node.js', (variable, value) => {
    expect(() => parseEnvironment({ [variable]: value })).toThrow(
      new RegExp(`Configuration validation error: ${variable}`)
    );
  });
});

describe('parseEnvironment', () => {
  it('names every invalid variable', () => {
    expect(() => parseEnvironment({ PORT: 'eighty', CACHE_MAXIMUM_ENTRIES: '0' })).toThrow(
      /^Configuration validation error: PORT: .+\nCACHE_MAXIMUM_ENTRIES: .+$/
    );
  });

  it('ignores variables it does not know', () => {
    expect(parseEnvironment({ HOME: '/home/node' })).toEqual(environmentSchema.parse({}));
  });
});
