const OPENING_DAY = [{ opening: '06:00', closing: '22:00' }];

const OPENING_TIMES = {
  monday: OPENING_DAY,
  tuesday: OPENING_DAY,
  wednesday: OPENING_DAY,
  thursday: OPENING_DAY,
  friday: OPENING_DAY,
  saturday: OPENING_DAY,
  sunday: [],
  publicHoliday: [],
};

export const ARAL_STATION_ID = '11111111-1111-4111-8111-111111111111';
export const FREE_STATION_ID = '22222222-2222-4222-8222-222222222222';
export const SHELL_STATION_ID = '33333333-3333-4333-8333-333333333333';

export const GERMAN_STATIONS_PATH = '/gas-stations';

/**
 * tankentanken list response around Kassel (51.3127, 9.4797). The upstream `distance` values are
 * deliberately off: the API computes distances itself from the exact position.
 */
export const germanStations = [
  {
    id: ARAL_STATION_ID,
    name: 'Aral Tankstelle Wilhelmshöhe',
    brand: 'Aral',
    address: {
      street: 'Wilhelmshöher Allee',
      houseNumber: '100',
      postalCode: '34119',
      city: 'Kassel',
      latitude: 51.315,
      longitude: 9.47,
    },
    fuelPrices: {
      e5: { price: 1.859, lastChange: '2026-09-30T08:00:00+00:00' },
      e10: null,
      diesel: { price: 1.689, lastChange: '2026-09-30T08:00:00+00:00' },
    },
    isOpen: true,
    openingTimes: OPENING_TIMES,
    distance: 850,
    publicHolidayIdentifier: null,
    mdmVersion: 1,
  },
  {
    id: FREE_STATION_ID,
    name: 'Freie Tankstelle am Bahnhof',
    brand: null,
    address: {
      street: 'Bahnhofstraße',
      houseNumber: null,
      postalCode: '34117',
      city: 'Kassel',
      latitude: 51.318,
      longitude: 9.489,
    },
    fuelPrices: {
      e5: null,
      e10: null,
      diesel: { price: 1.629, lastChange: '2026-09-30T08:00:00+00:00' },
    },
    isOpen: false,
    openingTimes: OPENING_TIMES,
    distance: 1200,
  },
  {
    id: SHELL_STATION_ID,
    name: 'Shell Kassel Nord',
    brand: 'Shell',
    address: {
      street: 'Holländische Straße',
      houseNumber: '45',
      postalCode: '34127',
      city: 'Kassel',
      latitude: 51.33,
      longitude: 9.5,
    },
    fuelPrices: {
      e5: { price: 1.879, lastChange: '2026-09-30T07:00:00+00:00' },
      e10: { price: 1.819, lastChange: '2026-09-30T07:00:00+00:00' },
      diesel: null,
    },
    isOpen: true,
    openingTimes: OPENING_TIMES,
    distance: 3120,
  },
];
