import { Inject, Injectable } from '@nestjs/common';
import { APPLICATION_VERSION } from '../../common/application-version.js';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { UpstreamFetcher } from '../../upstream/upstream-fetcher.js';
import { photonResponseSchema } from './photon-response.schema.js';
import type { PhotonFeature } from './photon-response.schema.js';

export const PHOTON_SEARCH_PATH = '/api';
const RESULT_LANGUAGE = 'de';
/**
 * `minimumLongitude,minimumLatitude,maximumLongitude,maximumLatitude` around metropolitan France,
 * Ouessant to Alsace and Corsica to Dunkirk.
 */
const FRANCE_BOUNDING_BOX = '-5.3,41.3,9.7,51.2';
const CONTACT_URL = 'https://genialtanken.alexf090.workers.dev';

/** Search requests to the public Photon (komoot) geocoder, cached per URL. */
@Injectable()
export class PhotonClient {
  /** Photon's usage policy asks for an identifying User-Agent. */
  private readonly userAgent: string;

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamFetcher: UpstreamFetcher,
    @Inject(APPLICATION_VERSION) applicationVersion: string
  ) {
    this.userAgent = `GenialTanken/${applicationVersion} (+${CONTACT_URL})`;
  }

  /** At most `limit` features in or near metropolitan France; fails with an `UpstreamError`. */
  async searchFeatures(query: string, limit: number): Promise<PhotonFeature[]> {
    const url = new URL(`${this.configuration.photonBaseUrl}${PHOTON_SEARCH_PATH}`);
    url.search = new URLSearchParams({
      q: query,
      lang: RESULT_LANGUAGE,
      limit: String(limit),
      bbox: FRANCE_BOUNDING_BOX,
    }).toString();
    const response = await this.upstreamFetcher.fetchJson({
      url,
      schema: photonResponseSchema,
      headers: { 'User-Agent': this.userAgent },
      cacheTimeToLiveInMilliseconds: this.configuration.placesCacheTimeToLiveInMilliseconds,
    });
    return response.features;
  }
}
