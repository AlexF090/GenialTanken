import { UPSTREAM_UNAVAILABLE_MESSAGE } from '@genialtanken/contracts';

/** Every client-facing error message of the API. */
export const ERROR_MESSAGES = {
  // Shared with the Cloudflare Pages Function, which answers the same when the API is unreachable.
  upstreamUnavailable: UPSTREAM_UNAVAILABLE_MESSAGE,
  stationNotFound: 'The station was not found.',
  invalidStationIdentifier: 'Station identifiers look like "fr-92242003".',
  placeSearchUnavailable: 'The place search is unavailable.',
  internalServerError: 'An unexpected error occurred.',
} as const;
