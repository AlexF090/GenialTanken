import { httpResource } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  DEFAULT_PLACE_LIMIT,
  MINIMUM_PLACE_QUERY_LENGTH,
  placesSchema,
} from '@genialtanken/contracts';
import type { Place } from '@genialtanken/contracts';
import { API_BASE_URL } from '../http/api-base-url';
import { parseResponse } from '../http/parse-response';

const parsePlaces = (body: unknown): readonly Place[] =>
  parseResponse(placesSchema, body, 'GET /api/places');

/**
 * Place search of the GenialTanken BFF. Responses are validated against the shared contract; a
 * mismatch surfaces as {@link UnexpectedResponseError}.
 * The resource factory must be called in an injection context (e.g. a field initializer).
 */
@Injectable({ providedIn: 'root' })
export class PlacesApi {
  private readonly placesUrl = `${inject(API_BASE_URL)}/places`;

  /**
   * Places matching the query; idle while the trimmed query is missing or shorter than
   * {@link MINIMUM_PLACE_QUERY_LENGTH}. Debouncing the query is up to the caller.
   */
  placesMatching(query: () => string | undefined): HttpResourceRef<readonly Place[] | undefined> {
    return httpResource(
      () => {
        const trimmedQuery = query()?.trim();
        if (trimmedQuery === undefined || trimmedQuery.length < MINIMUM_PLACE_QUERY_LENGTH) {
          return undefined;
        }
        return {
          url: this.placesUrl,
          params: { query: trimmedQuery, limit: DEFAULT_PLACE_LIMIT },
        };
      },
      { parse: parsePlaces }
    );
  }
}
