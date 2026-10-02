import { aralStation, carrefourStation, unbrandedStation } from '../../../testing/station-fixtures';
import { addressLinesBelowTitle, stationTitle } from './station-display';

describe('addressLinesBelowTitle', () => {
  it('shows street and city below a brand', () => {
    expect(stationTitle(aralStation)).toBe('Aral');
    expect(addressLinesBelowTitle(aralStation)).toEqual([
      'Wilhelmshöher Allee 100',
      '34119 Kassel',
    ]);
  });

  it('leaves out the street when it already is the title', () => {
    expect(stationTitle(unbrandedStation)).toBe('40 Avenue de Flandre');
    expect(addressLinesBelowTitle(unbrandedStation)).toEqual(['75019 Paris']);
  });

  it('keeps the street below the brand of a French station', () => {
    expect(addressLinesBelowTitle(carrefourStation)).toHaveLength(2);
  });
});
