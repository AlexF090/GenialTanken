import { createTestApplication } from './support/create-test-application.js';

describe('Startup configuration', () => {
  it('starts with the defaults', async () => {
    const application = await createTestApplication({});

    await application.close();
  });

  it('starts with several web origins, as during a move of the web app', async () => {
    const application = await createTestApplication({
      WEB_ORIGIN: 'https://genial-tanken.appool.de, https://genialtanken.alexf090.workers.dev',
    });

    await application.close();
  });

  it('ignores the retired proxy secret of the Worker', async () => {
    const application = await createTestApplication({ PROXY_SHARED_SECRET: 'short' });

    await application.close();
  });

  it.each([
    ['FRANCE_FUEL_PRICES_BASE_URL', 'not a url'],
    ['FRANCE_STATION_DETAILS_BASE_URL', 'not a url'],
    ['FRANCE_STATION_DETAILS_TIME_BUDGET_IN_MILLISECONDS', '0'],
    ['CACHE_MAXIMUM_ENTRIES', '0'],
    ['CACHE_MAXIMUM_ENTRIES', 'many'],
    ['FRANCE_SEARCHED_RECORDS_MAXIMUM_ENTRIES', '0'],
    ['PHOTON_BASE_URL', 'not a url'],
    ['PLACES_CACHE_TIME_TO_LIVE_IN_SECONDS', '0'],
    ['WEB_ORIGIN', 'genialtanken'],
    ['PORT', 'eighty'],
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', 'soon'],
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', '2147483648'],
    ['CACHE_TIME_TO_LIVE_IN_SECONDS', '-1'],
    ['RATE_LIMIT_REQUESTS_PER_MINUTE', '0'],
  ])('fails with a message naming %s when it is invalid', async (variable, value) => {
    await expect(createTestApplication({ [variable]: value })).rejects.toThrow(
      new RegExp(`Configuration validation error: ${variable}`)
    );
  });
});
