import { radiusStepsIncluding } from './radius-steps';

describe('radiusStepsIncluding', () => {
  it('offers the fixed steps when the current radius is one of them', () => {
    expect(radiusStepsIncluding(5)).toEqual([1, 2, 5, 10, 15, 25]);
  });

  it('adds a current radius between the steps in order', () => {
    expect(radiusStepsIncluding(12)).toEqual([1, 2, 5, 10, 12, 15, 25]);
  });

  it('never offers a radius outside the allowed range', () => {
    expect(radiusStepsIncluding(30)).toEqual([1, 2, 5, 10, 15, 25]);
  });
});
