import { resolveClientAddress } from './resolve-client-address.js';

const SHARED_SECRET = 'a-proxy-shared-secret-of-at-least-32-characters';
const CONNECTING_ADDRESS = '10.0.0.1';

const resolveWith = (forwardedClientAddress: string | string[], providedSecret = SHARED_SECRET) =>
  resolveClientAddress(
    { connectingAddress: CONNECTING_ADDRESS, providedSecret, forwardedClientAddress },
    SHARED_SECRET
  );

describe('resolveClientAddress', () => {
  it.each(['198.51.100.7', '2001:db8::1', ' 198.51.100.7 '])(
    'uses the forwarded client address %j with the shared secret',
    forwardedClientAddress => {
      expect(resolveWith(forwardedClientAddress)).toBe(forwardedClientAddress.trim());
    }
  );

  it.each([
    ['a list of addresses', '198.51.100.7, 203.0.113.9'],
    ['an address with port', '198.51.100.7:443'],
    ['an empty value', ''],
  ])('falls back to the connecting address for %s', (_description, forwardedClientAddress) => {
    expect(resolveWith(forwardedClientAddress)).toBe(CONNECTING_ADDRESS);
  });

  it('falls back to the connecting address for repeated headers', () => {
    expect(resolveWith(['198.51.100.7', '203.0.113.9'])).toBe(CONNECTING_ADDRESS);
  });

  it('falls back to the connecting address for a secret of a different length', () => {
    expect(resolveWith('198.51.100.7', `${SHARED_SECRET}x`)).toBe(CONNECTING_ADDRESS);
  });
});
