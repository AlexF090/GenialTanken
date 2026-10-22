import type { Place, PlacesQuery } from '@genialtanken/contracts';
import { Injectable, Logger } from '@nestjs/common';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import { UpstreamUnavailableError } from '../common/upstream-unavailable-error.js';
import { UpstreamError } from '../upstream/upstream-error.js';
import { PhotonClient } from './photon/photon-client.js';
import { toPlaceFromPhoton } from './photon/to-place-from-photon.js';
import { normalizePlaceQuery, selectPlaces } from './place-search.js';

/** Photon also answers places outside France; ask for more to keep enough of them. */
const CANDIDATES_PER_PLACE = 2;

/** Place suggestions for the search field. */
@Injectable()
export class PlacesService {
  private readonly logger = new Logger(PlacesService.name);

  constructor(private readonly photonClient: PhotonClient) {}

  /** Cached per normalized query and limit, as the same towns are searched again and again. */
  async findPlaces({ query, limit }: PlacesQuery): Promise<Place[]> {
    try {
      const features = await this.photonClient.searchFeatures(
        normalizePlaceQuery(query),
        limit * CANDIDATES_PER_PLACE
      );
      return selectPlaces(features.map(toPlaceFromPhoton), limit);
    } catch (error) {
      if (error instanceof UpstreamError) {
        this.logger.warn(`Place search failed: ${error.message}`);
        throw new UpstreamUnavailableError(ERROR_MESSAGES.placeSearchUnavailable);
      }
      throw error;
    }
  }
}
