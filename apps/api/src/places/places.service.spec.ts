import { createCache } from 'cache-manager';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import { UpstreamUnavailableError } from '../common/upstream-unavailable-error.js';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { parseEnvironment } from '../configuration/environment.js';
import { UpstreamError } from '../upstream/upstream-error.js';
import { UpstreamFetcher } from '../upstream/upstream-fetcher.js';
import type { PhotonFeature } from './photon/photon-response.schema.js';
import { PhotonClient } from './photon/photon-client.js';
import { PlacesService } from './places.service.js';

const createPlacesService = (failure: Error): PlacesService => {
  const configuration = new ApplicationConfiguration(parseEnvironment({}));

  class FailingPhotonClient extends PhotonClient {
    override searchFeatures(): Promise<PhotonFeature[]> {
      return Promise.reject(failure);
    }
  }

  return new PlacesService(
    new FailingPhotonClient(
      configuration,
      new UpstreamFetcher(configuration, createCache()),
      '2.0.0'
    )
  );
};

describe('PlacesService', () => {
  it('turns an upstream failure into an unavailable place search', async () => {
    const placesService = createPlacesService(
      new UpstreamError('GET /api responded with status 500')
    );

    await expect(placesService.findPlaces({ query: 'bastille', limit: 5 })).rejects.toThrow(
      new UpstreamUnavailableError(ERROR_MESSAGES.placeSearchUnavailable)
    );
  });

  it('rethrows other errors unchanged', async () => {
    const programmingError = new TypeError('features is not iterable');
    const placesService = createPlacesService(programmingError);

    await expect(placesService.findPlaces({ query: 'bastille', limit: 5 })).rejects.toBe(
      programmingError
    );
  });
});
