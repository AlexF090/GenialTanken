import type { FrenchRecord } from './french-record.schema.js';
import { toStationFromFrance } from './to-station-from-france.js';

const frenchRecord: FrenchRecord = {
  id: 13001004,
  adresse: '5 Boulevard Michelet',
  ville: 'Marseille',
  cp: '13008',
  geom: { lon: 5.3955, lat: 43.2668 },
  horaires: null,
  gazole_prix: 1.899,
  sp95_prix: null,
  e10_prix: 1.759,
  sp98_prix: 1.869,
  e85_prix: 0.899,
  gplc_prix: 0.999,
  distance_in_meters: 1499.5,
};

describe('toStationFromFrance', () => {
  it('maps a French record to a station', () => {
    expect(toStationFromFrance(frenchRecord)).toEqual({
      id: 'fr-13001004',
      country: 'FR',
      name: null,
      brand: null,
      address: {
        street: '5 Boulevard Michelet',
        houseNumber: null,
        postalCode: '13008',
        city: 'Marseille',
        latitude: 43.2668,
        longitude: 5.3955,
      },
      pricesInEuro: {
        e5: null,
        e10: 1.759,
        superPlus: 1.869,
        diesel: 1.899,
        e85: 0.899,
        lpg: 0.999,
      },
      isOpen: null,
      openingTimes: {
        monday: [],
        tuesday: [],
        wednesday: [],
        thursday: [],
        friday: [],
        saturday: [],
        sunday: [],
        publicHoliday: [],
      },
      distanceInMeters: 1500,
    });
  });

  it('reports an unknown distance and missing prices as null', () => {
    const station = toStationFromFrance({
      ...frenchRecord,
      distance_in_meters: undefined,
      e85_prix: undefined,
      gplc_prix: 0,
    });

    expect(station.distanceInMeters).toBeNull();
    expect(station.pricesInEuro.e85).toBeNull();
    expect(station.pricesInEuro.lpg).toBeNull();
  });

  it('uses empty address parts when the record lacks them', () => {
    const station = toStationFromFrance({ ...frenchRecord, adresse: null, ville: null, cp: null });

    expect(station.address).toEqual({
      street: '',
      houseNumber: null,
      postalCode: '',
      city: '',
      latitude: 43.2668,
      longitude: 5.3955,
    });
  });
});
