import { roundCoordinate } from './round-coordinate.js';

describe('roundCoordinate', () => {
  it.each([
    [48.8566, '48.857'],
    [9.4797, '9.48'],
    [-0.0754, '-0.075'],
    [51, '51'],
  ])('rounds %d to three decimals as %s', (coordinate, expected) => {
    expect(roundCoordinate(coordinate)).toBe(expected);
  });

  it('maps positions about 100 m apart to the same value', () => {
    expect(roundCoordinate(51.3127)).toBe(roundCoordinate(51.3131));
  });
});
