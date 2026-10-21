import { ERROR_MESSAGES } from '../common/error-messages.js';
import {
  splitStationIdentifier,
  stationIdentifierSchema,
  toCountryPrefix,
  toStationIdentifier,
} from './station-identifier.js';

describe('toStationIdentifier', () => {
  it('prefixes the local identifier with the lowercase country code', () => {
    expect(toStationIdentifier('FR', '92242003')).toBe('fr-92242003');
    expect(toStationIdentifier('DE', '005056ba-7cb6')).toBe('de-005056ba-7cb6');
  });
});

describe('toCountryPrefix', () => {
  it('lowercases the country code', () => {
    expect(toCountryPrefix('DE')).toBe('de');
  });
});

describe('splitStationIdentifier', () => {
  it('splits at the first separator only', () => {
    expect(splitStationIdentifier('de-005056ba-7cb6')).toEqual({
      countryPrefix: 'de',
      localIdentifier: '005056ba-7cb6',
    });
  });
});

describe('stationIdentifierSchema', () => {
  it('accepts a prefixed identifier', () => {
    expect(stationIdentifierSchema.parse('fr-92242003')).toBe('fr-92242003');
  });

  it('rejects a malformed identifier with the client-facing message', () => {
    const result = stationIdentifierSchema.safeParse('92242003');

    expect(result.error?.issues[0]?.message).toBe(ERROR_MESSAGES.invalidStationIdentifier);
  });
});
