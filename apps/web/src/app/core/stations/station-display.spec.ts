import { essoStation, carrefourStation, unbrandedStation } from '../../../testing/station-fixtures';
import { addressLinesBelowTitle, addressLinesOf, stationTitle } from './station-display';

describe('addressLinesBelowTitle', () => {
  it('shows street and city below a brand', () => {
    expect(stationTitle(essoStation)).toBe('Esso');
    expect(addressLinesBelowTitle(essoStation)).toEqual([
      'Boulevard Vivier-Merle 19',
      '69003 Lyon',
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

describe('addressLinesOf', () => {
  it('lists street with house number and postal code with city', () => {
    expect(addressLinesOf(essoStation)).toEqual(['Boulevard Vivier-Merle 19', '69003 Lyon']);
  });

  it('keeps the street even when it is the title', () => {
    expect(addressLinesOf(unbrandedStation)).toEqual(['40 Avenue de Flandre', '75019 Paris']);
  });

  it('leaves out empty lines and blank parts', () => {
    const station = {
      ...essoStation,
      address: { ...essoStation.address, street: ' ', houseNumber: null, postalCode: '69003' },
    };

    expect(addressLinesOf(station)).toEqual(['69003 Lyon']);
  });
});
