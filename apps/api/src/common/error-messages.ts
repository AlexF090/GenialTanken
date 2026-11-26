/** Every client-facing error message of the API. */
export const ERROR_MESSAGES = {
  // Shared with the Cloudflare Worker, which answers the same when the API is unreachable.
  upstreamUnavailable: 'The fuel price service is unavailable.',
  stationNotFound: 'The station was not found.',
  invalidStationIdentifier: 'Station identifiers look like "fr-92242003".',
  placeSearchUnavailable: 'The place search is unavailable.',
  internalServerError: 'An unexpected error occurred.',
} as const;
