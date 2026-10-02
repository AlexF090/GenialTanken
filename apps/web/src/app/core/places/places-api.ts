import { httpResource } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  DEFAULT_PLACE_LIMIT,
  MINIMUM_PLACE_QUERY_LENGTH,
  placesSchema,
} from '@genialtanken/contracts';
import type { Place } from '@genialtanken/contracts';
import { UnexpectedResponseError } from '../http/unexpected-response-error';

/** Same origin: dev proxy locally, a Cloudflare Pages Function in production. */
const PLACES_URL = '/api/places';

const parsePlaces = (body: unknown): readonly Place[] => {
  const result = placesSchema.safeParse(body);
  if (!result.success) {
    throw new UnexpectedResponseError('GET /api/places', result.error.message);
  }
  return result.data;
};

/**
 * Place search of the GenialTanken BFF. Responses are validated against the shared contract; a
 * mismatch surfaces as {@link UnexpectedResponseError}.
 * The resource factory must be called in an injection context (e.g. a field initializer).
 */
@Injectable({ providedIn: 'root' })
export class PlacesApi {
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
          url: PLACES_URL,
          params: { query: trimmedQuery, limit: DEFAULT_PLACE_LIMIT },
        };
      },
      { parse: parsePlaces }
    );
  }
}
