/** A data source behind the API failed, timed out or answered with something unusable. */
export class UpstreamError extends Error {
  override readonly name: string = 'UpstreamError';
}

/**
 * The caller gave up on the request through its own signal, e.g. because a time budget was
 * spent. Says nothing about the data source, so it is deliberately no `UpstreamError`: callers
 * must neither remember it as a failure nor report the source as unavailable.
 */
export class UpstreamAbortedError extends Error {
  override readonly name: string = 'UpstreamAbortedError';
}
