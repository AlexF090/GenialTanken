/** A data source behind the API failed, timed out or answered with something unusable. */
export class UpstreamError extends Error {
  override readonly name: string = 'UpstreamError';
}
