import { describe, expect, it } from 'vitest';
import {
  MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST,
  STATION_IDENTIFIER_PATTERN,
  stationLookupQuerySchema,
  stationLookupSchema,
} from './index.js';

const openingDay = [{ opening: '06:00', closing: '22:00' }];

const station = {
  id: 'fr-92242003',
  country: 'FR',
  name: null,
  brand: null,
  address: {
    street: '12 Avenue Pierre Brossolette',
    houseNumber: null,
    postalCode: '92240',
    city: 'Malakoff',
    latitude: 48.821,
    longitude: 2.312,
  },
  pricesInEuro: { e5: null, e10: 1.99, superPlus: null, diesel: 2.25, e85: 0.909, lpg: null },
  isOpen: true,
  openingTimes: {
    monday: openingDay,
    tuesday: openingDay,
    wednesday: openingDay,
    thursday: openingDay,
    friday: openingDay,
    saturday: openingDay,
    sunday: [],
    publicHoliday: [],
  },
  distanceInMeters: null,
};

describe('STATION_IDENTIFIER_PATTERN', () => {
  it.each(['fr-92242003', 'fr-005056ba-7cb6-1ed2-bceb-90e59ad2cd35'])('accepts %s', identifier => {
    expect(STATION_IDENTIFIER_PATTERN.test(identifier)).toBe(true);
  });

  it.each(['92242003', 'FR-92242003', 'fr-', 'fr-922 42003', 'fr-92242003/../x'])(
    'rejects %s',
    identifier => {
      expect(STATION_IDENTIFIER_PATTERN.test(identifier)).toBe(false);
    }
  );
});

describe('stationLookupQuerySchema', () => {
  it('splits comma-separated identifiers', () => {
    expect(stationLookupQuerySchema.parse({ identifiers: 'fr-1,fr-abc-2' })).toEqual({
      identifiers: ['fr-1', 'fr-abc-2'],
    });
  });

  it('trims entries, drops empty ones and removes duplicates', () => {
    expect(stationLookupQuerySchema.parse({ identifiers: ' fr-1 ,, fr-2,fr-1, ' })).toEqual({
      identifiers: ['fr-1', 'fr-2'],
    });
  });

  it('accepts 50 identifiers', () => {
    const identifiers = Array.from({ length: 50 }, (_, index) => `fr-${String(index)}`);
    expect(stationLookupQuerySchema.parse({ identifiers: identifiers.join(',') })).toEqual({
      identifiers,
    });
  });

  it('counts identifiers after removing duplicates', () => {
    const identifiers = [
      ...Array.from({ length: 50 }, (_, index) => `fr-${String(index)}`),
      'fr-0',
    ];
    expect(stationLookupQuerySchema.safeParse({ identifiers: identifiers.join(',') }).success).toBe(
      true
    );
  });

  it.each([
    ['a missing parameter', {}],
    ['an empty parameter', { identifiers: '' }],
    ['only separators', { identifiers: ' , ,' }],
    ['a malformed identifier', { identifiers: 'fr-1,92242003' }],
    [
      '51 identifiers',
      { identifiers: Array.from({ length: 51 }, (_, index) => `fr-${String(index)}`).join(',') },
    ],
  ])('rejects %s', (_description, query) => {
    expect(stationLookupQuerySchema.safeParse(query).success).toBe(false);
  });

  it('allows at most 50 identifiers per request', () => {
    expect(MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST).toBe(50);
  });
});

describe('stationLookupSchema', () => {
  it('accepts found stations and the identifiers that were not found or failed', () => {
    const lookup = {
      stations: [station],
      unavailableIdentifiers: ['fr-404'],
      failedIdentifiers: ['fr-500'],
    };
    expect(stationLookupSchema.parse(lookup)).toEqual(lookup);
  });

  it('rejects a lookup without the failed identifiers', () => {
    expect(
      stationLookupSchema.safeParse({ stations: [], unavailableIdentifiers: [] }).success
    ).toBe(false);
  });
});
