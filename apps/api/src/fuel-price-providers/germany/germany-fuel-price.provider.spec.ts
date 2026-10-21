import { ConfigService } from '@nestjs/config';
import { createCache } from 'cache-manager';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { UpstreamJsonFetcher } from '../../upstream/upstream-json-fetcher.js';
import { FuelPriceProviderError } from '../fuel-price-provider.js';
import { GermanyFuelPriceProvider } from './germany-fuel-price.provider.js';

const KNOWN_STATION_GUID = '005056ba-7cb6-1ed2-bceb-90e59ad2cd35';

const createProviderWithoutApiKey = (): GermanyFuelPriceProvider => {
  // A closed local port: the provider must fail before it sends anything.
  const configuration = new ApplicationConfiguration(
    new ConfigService({
      TANKENTANKEN_BASE_URL: 'http://127.0.0.1:9',
      UPSTREAM_TIMEOUT_IN_MILLISECONDS: 100,
    })
  );
  return new GermanyFuelPriceProvider(
    configuration,
    new UpstreamJsonFetcher(configuration, createCache())
  );
};

describe('GermanyFuelPriceProvider without an API key', () => {
  it('refuses to search for stations', async () => {
    const provider = createProviderWithoutApiKey();

    await expect(
      provider.findStationsAround({
        latitude: 51.3127,
        longitude: 9.4797,
        radiusInKilometers: 5,
        fuel: 'e5',
      })
    ).rejects.toThrow(FuelPriceProviderError);
  });

  it('refuses to look up a station', async () => {
    const provider = createProviderWithoutApiKey();

    await expect(provider.findStationByIdentifier(KNOWN_STATION_GUID)).rejects.toThrow(
      FuelPriceProviderError
    );
  });

  it('answers a malformed identifier without asking the upstream', async () => {
    const provider = createProviderWithoutApiKey();

    await expect(provider.findStationByIdentifier('not-a-guid')).resolves.toBeNull();
  });
});
