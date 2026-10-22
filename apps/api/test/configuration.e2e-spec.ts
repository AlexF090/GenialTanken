import { createTestApplication } from './support/create-test-application.js';

describe('Startup configuration', () => {
  it('starts with the defaults', async () => {
    const application = await createTestApplication({});

    await application.close();
  });

  it('treats an empty proxy shared secret as not configured', async () => {
    const application = await createTestApplication({ PROXY_SHARED_SECRET: ' ' });

    await application.close();
  });

  it('starts with a proxy shared secret of 32 characters', async () => {
    const application = await createTestApplication({ PROXY_SHARED_SECRET: 'x'.repeat(32) });

    await application.close();
  });

  it.each([
    ['FRANCE_FUEL_PRICES_BASE_URL', 'not a url'],
    ['FRANCE_STATION_DETAILS_BASE_URL', 'not a url'],
    ['FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS', '0'],
    ['CACHE_MAXIMUM_ENTRIES', '0'],
    ['CACHE_MAXIMUM_ENTRIES', 'many'],
    ['PHOTON_BASE_URL', 'not a url'],
    ['PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS', '0'],
    ['WEB_ORIGIN', 'genialtanken'],
    ['PORT', 'eighty'],
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', 'soon'],
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', '2147483648'],
    ['CACHE_TIME_TO_LIVE_IN_SECONDS', '-1'],
    ['RATE_LIMIT_REQUESTS_PER_MINUTE', '0'],
    ['PROXY_SHARED_SECRET', 'shorter-than-32-characters'],
  ])('fails with a message naming %s when it is invalid', async (variable, value) => {
    await expect(createTestApplication({ [variable]: value })).rejects.toThrow(
      new RegExp(`Configuration validation error: ${variable}`)
    );
  });
});
