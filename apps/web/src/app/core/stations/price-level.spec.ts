import { priceLevelOf, priceRangeOf } from './price-level';

describe('priceRangeOf', () => {
  it('spans the known prices and ignores missing ones', () => {
    expect(priceRangeOf([1.899, null, 1.759, 1.829])).toEqual({
      minimumInEuro: 1.759,
      maximumInEuro: 1.899,
    });
  });

  it('is undefined without any price', () => {
    expect(priceRangeOf([])).toBeUndefined();
    expect(priceRangeOf([null])).toBeUndefined();
  });
});

describe('priceLevelOf', () => {
  const range = { minimumInEuro: 1.7, maximumInEuro: 1.9 };

  it('rates the cheaper third low, the middle medium and the dearer third high', () => {
    expect(priceLevelOf(1.7, range)).toBe('low');
    expect(priceLevelOf(1.76, range)).toBe('low');
    expect(priceLevelOf(1.8, range)).toBe('medium');
    expect(priceLevelOf(1.84, range)).toBe('high');
    expect(priceLevelOf(1.9, range)).toBe('high');
  });

  it('rates every price low when all prices are equal', () => {
    expect(priceLevelOf(1.8, { minimumInEuro: 1.8, maximumInEuro: 1.8 })).toBe('low');
  });
});
