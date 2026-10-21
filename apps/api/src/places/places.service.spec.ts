import { BadGatewayException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCache } from 'cache-manager';
import type { z } from 'zod';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { environmentSchema } from '../configuration/environment.js';
import { UpstreamError } from '../upstream/upstream-error.js';
import { UpstreamJsonFetcher } from '../upstream/upstream-json-fetcher.js';
import { PlacesService } from './places.service.js';

const createPlacesService = (failure: Error): PlacesService => {
  const configuration = new ApplicationConfiguration(
    new ConfigService(environmentSchema.parse({ PHOTON_BASE_URL: 'http://photon.test' }))
  );

  class FailingUpstreamJsonFetcher extends UpstreamJsonFetcher {
    override fetchRequired<Schema extends z.ZodType>(): Promise<z.infer<Schema>> {
      return Promise.reject(failure);
    }
  }

  return new PlacesService(
    configuration,
    new FailingUpstreamJsonFetcher(configuration, createCache())
  );
};

describe('PlacesService', () => {
  it('turns an upstream failure into a bad gateway with the place search message', async () => {
    const placesService = createPlacesService(
      new UpstreamError('GET /api responded with status 500')
    );

    const failure = placesService.findPlaces({ query: 'bastille', limit: 5 });

    await expect(failure).rejects.toBeInstanceOf(BadGatewayException);
    await expect(failure).rejects.toThrow(ERROR_MESSAGES.placeSearchUnavailable);
  });

  it('rethrows other errors unchanged', async () => {
    const programmingError = new TypeError('features is not iterable');
    const placesService = createPlacesService(programmingError);

    await expect(placesService.findPlaces({ query: 'bastille', limit: 5 })).rejects.toBe(
      programmingError
    );
  });
});
