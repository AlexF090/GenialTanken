import { UpstreamError } from './upstream-error.js';

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

export interface UpstreamRequestOptions {
  accept: string;
  headers: Record<string, string>;
  timeoutInMilliseconds: number;
}

/**
 * GETs a data source with a timeout. Resolves to `undefined` on 404; every other failure throws
 * an `UpstreamError`.
 */
export const requestUpstream = async (
  url: URL,
  { accept, headers, timeoutInMilliseconds }: UpstreamRequestOptions
): Promise<Response | undefined> => {
  const signal = AbortSignal.timeout(timeoutInMilliseconds);
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: accept, ...headers }, signal });
  } catch (error) {
    throw new UpstreamError(`GET ${url.pathname} ${describeUpstreamFailure(error)}`);
  }
  if (response.status === NOT_FOUND_STATUS) {
    return undefined;
  }
  if (!response.ok) {
    throw new UpstreamError(`GET ${url.pathname} responded with status ${String(response.status)}`);
  }
  return response;
};
