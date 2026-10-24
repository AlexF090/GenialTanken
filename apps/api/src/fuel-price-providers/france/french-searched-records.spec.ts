import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { parseEnvironment } from '../../configuration/environment.js';
import type { FrenchRecord } from './french-record.schema.js';
import { FrenchSearchedRecords } from './french-searched-records.js';

const recordWith = (id: number): FrenchRecord => ({
  id,
  adresse: '5 Boulevard Michelet',
  ville: 'Marseille',
  cp: '13008',
  geom: { lon: 5.3955, lat: 43.2668 },
  horaires: null,
  gazole_prix: 1.899,
  sp95_prix: null,
  e10_prix: 1.759,
  sp98_prix: 1.869,
  e85_prix: null,
  gplc_prix: null,
});

const createSearchedRecords = (variables: Record<string, string> = {}) =>
  new FrenchSearchedRecords(new ApplicationConfiguration(parseEnvironment(variables)));

describe('FrenchSearchedRecords', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('forgets the least recently remembered records beyond the maximum entries', () => {
    const searchedRecords = createSearchedRecords({ FRANCE_SEARCHED_RECORDS_MAXIMUM_ENTRIES: '2' });

    searchedRecords.remember([recordWith(1), recordWith(2), recordWith(3)], Date.now());

    expect(searchedRecords.find('1')).toBeUndefined();
    expect(searchedRecords.find('3')).toEqual(recordWith(3));
  });

  it('keeps a record only until the cache time to live after its fetch', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(1_000_000);
    const searchedRecords = createSearchedRecords({ CACHE_TIME_TO_LIVE_IN_SECONDS: '300' });

    searchedRecords.remember([recordWith(1)], 1_000_000 - 200_000);
    vi.setSystemTime(1_100_001);

    expect(searchedRecords.find('1')).toBeUndefined();
  });

  it('ignores records fetched before the remembered ones', () => {
    const searchedRecords = createSearchedRecords();
    const newerRecord = { ...recordWith(1), e10_prix: 2.049 };

    searchedRecords.remember([newerRecord], Date.now());
    searchedRecords.remember([recordWith(1)], Date.now() - 1000);

    expect(searchedRecords.find('1')).toEqual(newerRecord);
  });
});
