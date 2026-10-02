import { createTestApplication } from './support/create-test-application.js';

describe('Startup configuration', () => {
  it('starts without a German API key, with only the French provider', async () => {
    const application = await createTestApplication({ TANKENTANKEN_API_KEY: undefined });

    await application.close();
  });

  it('treats an empty German API key as not configured', async () => {
    const application = await createTestApplication({ TANKENTANKEN_API_KEY: ' ' });

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
    ['TANKENTANKEN_BASE_URL', 'not a url'],
    ['WEB_ORIGIN', 'genialtanken'],
    ['PORT', 'eighty'],
    ['UPSTREAM_TIMEOUT_IN_MILLISECONDS', 'soon'],
    ['CACHE_TIME_TO_LIVE_IN_SECONDS', '-1'],
    ['RATE_LIMIT_REQUESTS_PER_MINUTE', '0'],
    ['PROXY_SHARED_SECRET', 'shorter-than-32-characters'],
  ])('fails with a message naming %s when it is invalid', async (variable, value) => {
    await expect(createTestApplication({ [variable]: value })).rejects.toThrow(
      new RegExp(`Config validation error: ${variable}`)
    );
  });
});
