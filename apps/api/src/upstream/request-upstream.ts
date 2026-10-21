import { UpstreamAbortedError, UpstreamError } from './upstream-error.js';

const NOT_FOUND_STATUS = 404;

export const describeUpstreamFailure = (error: unknown): string => {
  if (error instanceof DOMException && error.name === 'TimeoutError') {
    return 'timed out';
  }
  if (error instanceof SyntaxError) {
    return 'returned a body that is not JSON';
  }
  if (error instanceof Error) {
    return `failed: ${error.message}`;
  }
  return 'failed for an unknown reason';
};

/** Also used for failures while reading the body, which the same signal can abort. */
export const toUpstreamError = (
  url: URL,
  error: unknown,
  callerSignal: AbortSignal | undefined
): UpstreamError => {
  if (callerSignal?.aborted === true) {
    return new UpstreamAbortedError(`GET ${url.pathname} was aborted by the caller`);
  }
  return new UpstreamError(`GET ${url.pathname} ${describeUpstreamFailure(error)}`);
};

export interface UpstreamRequestOptions {
  accept: string;
  headers: Record<string, string>;
  timeoutInMilliseconds: number;
  /** Lets the caller give up early; the request then fails with an `UpstreamAbortedError`. */
  signal?: AbortSignal;
}

/**
 * GETs a data source with a timeout. Resolves to `undefined` on 404; every other failure throws
 * an `UpstreamError`.
 */
export const requestUpstream = async (
  url: URL,
  { accept, headers, timeoutInMilliseconds, signal: callerSignal }: UpstreamRequestOptions
): Promise<Response | undefined> => {
  const timeoutSignal = AbortSignal.timeout(timeoutInMilliseconds);
  const signal =
    callerSignal === undefined ? timeoutSignal : AbortSignal.any([timeoutSignal, callerSignal]);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: accept, ...headers }, signal });
  } catch (error) {
    throw toUpstreamError(url, error, callerSignal);
  }
  if (response.status === NOT_FOUND_STATUS) {
    return undefined;
  }
  if (!response.ok) {
    throw new UpstreamError(`GET ${url.pathname} responded with status ${String(response.status)}`);
  }
  return response;
};
