/** Every client-facing error message of the API. */
export const ERROR_MESSAGES = {
  upstreamUnavailable: 'The fuel price service is unavailable.',
  stationNotFound: 'The station was not found.',
  internalServerError: 'An unexpected error occurred.',
} as const;
