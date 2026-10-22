import { frenchStationPagePath } from '../../src/fuel-price-providers/france/french-upstream-paths.js';
import type { FakeResponse } from './fake-upstream.js';

const day = (id: string, name: string, hours: unknown, closed = '') => ({
  '@id': id,
  '@nom': name,
  '@ferme': closed,
  ...(hours === undefined ? {} : { horaire: hours }),
});

const SPLIT_HOURS = [
  { '@ouverture': '06.00', '@fermeture': '12.00' },
  { '@ouverture': '14.00', '@fermeture': '20.30' },
];
const REGULAR_HOURS = { '@ouverture': '05.00', '@fermeture': '23.00' };

export const RAPEE_RECORD_ID = 75012010;
export const AUTOMATE_RECORD_ID = 75015001;
export const WITHOUT_E10_RECORD_ID = 75011002;

export const rapeeRecord = {
  id: RAPEE_RECORD_ID,
  latitude: '4884200',
  longitude: '237300',
  cp: '75012',
  pop: 'R',
  adresse: '36 Quai de la Rapée',
  ville: 'Paris',
  horaires: JSON.stringify({
    '@automate-24-24': '',
    jour: [
      day('1', 'Lundi', SPLIT_HOURS),
      day('2', 'Mardi', REGULAR_HOURS),
      day('3', 'Mercredi', REGULAR_HOURS),
      day('4', 'Jeudi', REGULAR_HOURS),
      day('5', 'Vendredi', REGULAR_HOURS),
      day('6', 'Samedi', REGULAR_HOURS),
      day('7', 'Dimanche', undefined, '1'),
    ],
  }),
  services: null,
  prix: '[]',
  geom: { lon: 2.373, lat: 48.842 },
  gazole_maj: '2026-10-02T07:31:00+00:00',
  gazole_prix: 2.391,
  sp95_maj: null,
  sp95_prix: null,
  e85_maj: null,
  e85_prix: null,
  gplc_maj: null,
  gplc_prix: null,
  e10_maj: '2026-10-02T07:31:00+00:00',
  e10_prix: 2.152,
  sp98_maj: '2026-10-02T07:31:00+00:00',
  sp98_prix: 2.286,
  carburants_disponibles: ['Gazole', 'E10', 'SP98'],
  horaires_automate_24_24: 'Non',
  departement: 'Paris',
  region: 'Île-de-France',
};

const automateRecord = {
  ...rapeeRecord,
  id: AUTOMATE_RECORD_ID,
  cp: '75015',
  adresse: '12 Rue de Vaugirard',
  geom: { lon: 2.3, lat: 48.84 },
  horaires: JSON.stringify({
    '@automate-24-24': '1',
    jour: [day('1', 'Lundi', REGULAR_HOURS)],
  }),
  gazole_prix: null,
  e10_prix: 2.099,
  sp98_prix: null,
  sp95_prix: 2.149,
  horaires_automate_24_24: 'Oui',
};

const withoutE10Record = {
  ...rapeeRecord,
  id: WITHOUT_E10_RECORD_ID,
  cp: '75011',
  adresse: '1 Boulevard Voltaire',
  geom: { lon: 2.38, lat: 48.86 },
  horaires: null,
  e10_prix: null,
};

export const OUTSIDE_RADIUS_RECORD_ID = 75018003;

/** About 5004 m north of the test position, just outside a 5 km radius. */
const outsideRadiusRecord = {
  ...rapeeRecord,
  id: OUTSIDE_RADIUS_RECORD_ID,
  cp: '75018',
  adresse: '2 Rue Ordener',
  geom: { lon: 2.3522, lat: 48.9016 },
};

/** Records as returned by the French open data API. */
export const frenchRecords = [rapeeRecord, automateRecord, withoutE10Record, outsideRadiusRecord];

export const frenchResponse = (records: unknown[]) => ({
  total_count: records.length,
  results: records,
});

const REGULAR_DAY = [{ opening: '05:00', closing: '23:00' }];

/** `rapeeRecord` as the API answers it for a search from `PARIS`. */
export const EXPECTED_RAPEE_STATION = {
  id: 'fr-75012010',
  country: 'FR',
  name: null,
  brand: null,
  address: {
    street: '36 Quai de la Rapée',
    houseNumber: null,
    postalCode: '75012',
    city: 'Paris',
    latitude: 48.842,
    longitude: 2.373,
  },
  pricesInEuro: { e5: null, e10: 2.152, superPlus: 2.286, diesel: 2.391, e85: null, lpg: null },
  isOpen: null,
  openingTimes: {
    monday: [
      { opening: '06:00', closing: '12:00' },
      { opening: '14:00', closing: '20:30' },
    ],
    tuesday: REGULAR_DAY,
    wednesday: REGULAR_DAY,
    thursday: REGULAR_DAY,
    friday: REGULAR_DAY,
    saturday: REGULAR_DAY,
    sunday: [],
    publicHoliday: [],
  },
  distanceInMeters: 2225,
};

export const RAPEE_STATION_PAGE_PATH = frenchStationPagePath(RAPEE_RECORD_ID);

/** Station page of `rapeeRecord` on the price service's website (recorded, shortened). */
export const RAPEE_STATION_PAGE: FakeResponse = {
  status: 200,
  contentType: 'text/html; charset=UTF-8',
  body: '<h3 class="fr-text--md">RELAIS DE LA RAPEE</h3><p><strong>TotalEnergies</strong><br />Quai de la Rapée</p>',
};
