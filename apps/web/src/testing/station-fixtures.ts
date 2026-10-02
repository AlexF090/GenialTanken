import type { OpeningTimes, Station } from '@genialtanken/contracts';

const DAILY_OPENING_TIMES: OpeningTimes = {
  monday: [{ opening: '06:00', closing: '22:00' }],
  tuesday: [{ opening: '06:00', closing: '22:00' }],
  wednesday: [{ opening: '06:00', closing: '22:00' }],
  thursday: [{ opening: '06:00', closing: '22:00' }],
  friday: [{ opening: '06:00', closing: '22:00' }],
  saturday: [
    { opening: '07:00', closing: '12:00' },
    { opening: '14:00', closing: '20:00' },
  ],
  sunday: [],
  publicHoliday: [{ opening: '08:00', closing: '12:00' }],
};

export const PARIS = { latitude: 48.8566, longitude: 2.3522 };

/** Nearest station, most expensive E5; French open data: brand but no name, no live status. */
export const totalStation: Station = {
  id: 'fr-75001001',
  country: 'FR',
  name: null,
  brand: 'TotalEnergies',
  address: {
    street: '12 Rue de Rivoli',
    houseNumber: null,
    postalCode: '75001',
    city: 'Paris',
    latitude: 48.86,
    longitude: 2.342,
  },
  pricesInEuro: { e5: 1.859, e10: 1.799, superPlus: 1.929, diesel: 1.689, e85: null, lpg: null },
  isOpen: null,
  openingTimes: DAILY_OPENING_TIMES,
  distanceInMeters: 850,
};

/** Second nearest. */
export const carrefourStation: Station = {
  id: 'fr-75005002',
  country: 'FR',
  name: null,
  brand: 'Carrefour Market',
  address: {
    street: '5 Boulevard Saint-Michel',
    houseNumber: null,
    postalCode: '75005',
    city: 'Paris',
    latitude: 48.852,
    longitude: 2.37,
  },
  pricesInEuro: { e5: 1.839, e10: 1.779, superPlus: null, diesel: 1.669, e85: 0.899, lpg: 0.999 },
  isOpen: null,
  openingTimes: DAILY_OPENING_TIMES,
  distanceInMeters: 1949,
};

/** Neither brand nor name, no E10 price, cheapest E5. */
export const unbrandedStation: Station = {
  id: 'fr-75019003',
  country: 'FR',
  name: null,
  brand: null,
  address: {
    street: '40 Avenue de Flandre',
    houseNumber: null,
    postalCode: '75019',
    city: 'Paris',
    latitude: 48.87,
    longitude: 2.33,
  },
  pricesInEuro: { e5: 1.799, e10: null, superPlus: null, diesel: 1.649, e85: null, lpg: null },
  isOpen: null,
  openingTimes: DAILY_OPENING_TIMES,
  distanceInMeters: 3120,
};

/** German station with name and live opening status; closed. */
export const aralStation: Station = {
  id: 'de-11111111-1111-4111-8111-111111111111',
  country: 'DE',
  name: 'Aral Tankstelle Kassel',
  brand: 'Aral',
  address: {
    street: 'Wilhelmshöher Allee',
    houseNumber: '100',
    postalCode: '34119',
    city: 'Kassel',
    latitude: 51.3135,
    longitude: 9.4721,
  },
  pricesInEuro: { e5: 1.869, e10: 1.809, superPlus: 1.949, diesel: 1.699, e85: null, lpg: 1.049 },
  isOpen: false,
  openingTimes: DAILY_OPENING_TIMES,
  distanceInMeters: null,
};

/** Without a distance, as returned by `GET /api/stations/:id`. */
export const withoutDistance = (station: Station): Station => ({
  ...station,
  distanceInMeters: null,
});
