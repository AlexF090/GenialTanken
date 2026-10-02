import type { Place } from '@genialtanken/contracts';
import { normalizePlaceQuery, selectPlaces } from './place-search.js';

const place = (id: string): Place => ({
  id,
  name: `Place ${id}`,
  description: 'Frankreich',
  country: 'FR',
  latitude: 48.85,
  longitude: 2.36,
});

describe('normalizePlaceQuery', () => {
  it('trims, collapses whitespace and lowercases', () => {
    expect(normalizePlaceQuery('  Place   de la\tBASTILLE ')).toBe('place de la bastille');
  });
});

describe('selectPlaces', () => {
  it('skips unusable candidates and keeps the order', () => {
    expect(selectPlaces([place('N1'), null, place('W2')], 6)).toEqual([place('N1'), place('W2')]);
  });

  it('keeps the first of several candidates with the same identifier', () => {
    const duplicate = { ...place('N1'), name: 'Duplicate' };

    expect(selectPlaces([place('N1'), duplicate, place('W2')], 6)).toEqual([
      place('N1'),
      place('W2'),
    ]);
  });

  it('cuts the result to the limit after removing duplicates', () => {
    expect(selectPlaces([place('N1'), place('N1'), place('W2'), place('R3')], 2)).toEqual([
      place('N1'),
      place('W2'),
    ]);
  });
});
