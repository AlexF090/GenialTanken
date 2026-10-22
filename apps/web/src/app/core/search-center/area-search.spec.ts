import { shouldOfferAreaSearch } from './area-search';

const eiffelTower = { latitude: 48.8584, longitude: 2.2945 };
const placeDeLaBastille = { latitude: 48.8532, longitude: 2.3692 };

describe('shouldOfferAreaSearch', () => {
  it('does not offer a search before the map was moved', () => {
    expect(shouldOfferAreaSearch(eiffelTower, undefined, 5)).toBe(false);
  });

  it('does not offer a search for a shift of up to a quarter of the radius', () => {
    const slightlyEast = { latitude: 48.8584, longitude: 2.3 };

    expect(shouldOfferAreaSearch(eiffelTower, slightlyEast, 5)).toBe(false);
  });

  it('offers a search once the map moved further', () => {
    expect(shouldOfferAreaSearch(eiffelTower, placeDeLaBastille, 5)).toBe(true);
    expect(shouldOfferAreaSearch(eiffelTower, placeDeLaBastille, 25)).toBe(false);
  });
});
