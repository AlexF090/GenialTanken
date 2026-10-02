export const FRENCH_RECORDS_PATH =
  '/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

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

const rapeeRecord = {
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
  distance_in_meters: 2225.2944934935335,
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
  distance_in_meters: 4100.5,
};

const withoutE10Record = {
  ...rapeeRecord,
  id: WITHOUT_E10_RECORD_ID,
  cp: '75011',
  adresse: '1 Boulevard Voltaire',
  horaires: null,
  e10_prix: null,
  distance_in_meters: 4300,
};

/** Records as returned by the French open data API, nearest first. */
export const frenchRecords = [rapeeRecord, automateRecord, withoutE10Record];

export const frenchResponse = (records: unknown[]) => ({
  total_count: records.length,
  results: records,
});

const { distance_in_meters: _distanceInMeters, ...rapeeRecordWithoutDistance } = rapeeRecord;

/** Detail responses carry no distance. */
export const rapeeDetailRecord = rapeeRecordWithoutDistance;
