/**
 * A request cannot be answered because the data sources behind it failed. `ApiErrorFilter`
 * answers it with 502 and the message, so the message must come from `ERROR_MESSAGES`.
 */
export class UpstreamUnavailableError extends Error {
  override readonly name = 'UpstreamUnavailableError';
}
