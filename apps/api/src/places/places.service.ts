import type { Place, PlacesQuery } from '@genialtanken/contracts';
import { BadGatewayException, Injectable, Logger } from '@nestjs/common';
import { readApplicationVersion } from '../common/application-version.js';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import { ApplicationConfiguration } from '../configuration/application-configuration.js';
import { UpstreamError } from '../upstream/upstream-error.js';
import { UpstreamJsonFetcher } from '../upstream/upstream-json-fetcher.js';
import { photonResponseSchema } from './photon/photon-response.schema.js';
import { toPlaceFromPhoton } from './photon/to-place-from-photon.js';
import { normalizePlaceQuery, selectPlaces } from './place-search.js';

const SEARCH_PATH = '/api';
const RESULT_LANGUAGE = 'de';
/** Photon also answers places outside France; ask for more to keep enough of them. */
const CANDIDATES_PER_PLACE = 2;
/**
 * `minimumLongitude,minimumLatitude,maximumLongitude,maximumLatitude` around metropolitan France,
 * Ouessant to Alsace and Corsica to Dunkirk.
 */
const FRANCE_BOUNDING_BOX = '-5.3,41.3,9.7,51.2';
const CONTACT_URL = 'https://genialtanken.alexf090.workers.dev';

/** Place suggestions for the search field, from the public Photon (komoot) geocoder. */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);
  /** Photon's usage policy asks for an identifying User-Agent. */
  private readonly userAgent = `GenialTanken/${readApplicationVersion()} (+${CONTACT_URL})`;

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamJsonFetcher: UpstreamJsonFetcher
  ) {}

  /** Cached per normalized query and limit, as the same towns are searched again and again. */
  async findPlaces({ query, limit }: PlacesQuery): Promise<Place[]> {
    const url = new URL(`${this.configuration.photonBaseUrl}${SEARCH_PATH}`);
    url.search = new URLSearchParams({
      q: normalizePlaceQuery(query),
      lang: RESULT_LANGUAGE,
      limit: String(limit * CANDIDATES_PER_PLACE),
      bbox: FRANCE_BOUNDING_BOX,
    }).toString();

    try {
      const response = await this.upstreamJsonFetcher.fetchRequired({
        url,
        schema: photonResponseSchema,
        headers: { 'User-Agent': this.userAgent },
        cacheTimeToLiveInMilliseconds: this.configuration.placesCacheTimeToLiveInMilliseconds,
      });
      return selectPlaces(response.features.map(toPlaceFromPhoton), limit);
    } catch (error) {
      if (error instanceof UpstreamError) {
        this.logger.warn(`Place search failed: ${error.message}`);
        throw new BadGatewayException(ERROR_MESSAGES.placeSearchUnavailable);
      }
      throw error;
    }
  }
}
