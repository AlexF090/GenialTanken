import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { CLIENT_ADDRESS_HEADER, PROXY_SECRET_HEADER } from '@genialtanken/contracts';

// The Pages Function sets these headers; the names live in contracts so both sides agree.
export { CLIENT_ADDRESS_HEADER, PROXY_SECRET_HEADER };

type HeaderValue = string | string[] | undefined;

export interface ClientAddressSource {
  /** `request.ip`: the connecting address as seen behind Render's proxy. */
  connectingAddress: string | undefined;
  providedSecret: HeaderValue;
  forwardedClientAddress: HeaderValue;
}

const singleValue = (value: HeaderValue): string | undefined =>
  typeof value === 'string' ? value.trim() : undefined;

/** Compares in constant time; differing lengths are rejected without comparing the content. */
const secretsMatch = (expected: string, provided: string): boolean => {
  const expectedBytes = Buffer.from(expected);
  const providedBytes = Buffer.from(provided);
  if (expectedBytes.length !== providedBytes.length) {
    return false;
  }
  return timingSafeEqual(expectedBytes, providedBytes);
};

/**
 * The address to rate-limit a request by: the client address named by the Cloudflare Pages
 * Function when it proves itself with the shared secret, otherwise the connecting address.
 */
export const resolveClientAddress = (
  { connectingAddress, providedSecret, forwardedClientAddress }: ClientAddressSource,
  sharedSecret: string | undefined
): string | undefined => {
  if (sharedSecret === undefined) {
    return connectingAddress;
  }
  const secret = singleValue(providedSecret);
  if (secret === undefined || !secretsMatch(sharedSecret, secret)) {
    return connectingAddress;
  }
  const clientAddress = singleValue(forwardedClientAddress);
  if (clientAddress === undefined || isIP(clientAddress) === 0) {
    return connectingAddress;
  }
  return clientAddress;
};
