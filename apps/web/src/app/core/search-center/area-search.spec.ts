import { distanceInMetersBetween, shouldOfferAreaSearch } from './area-search';

const eiffelTower = { latitude: 48.8584, longitude: 2.2945 };
const placeDeLaBastille = { latitude: 48.8532, longitude: 2.3692 };

describe('distanceInMetersBetween', () => {
  it('is zero for the same point and about 5.5 km from the Eiffel Tower to the Bastille', () => {
    expect(distanceInMetersBetween(eiffelTower, eiffelTower)).toBe(0);
    const distance = distanceInMetersBetween(eiffelTower, placeDeLaBastille);
    expect(distance).toBeGreaterThan(5400);
    expect(distance).toBeLessThan(5600);
  });
});

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
