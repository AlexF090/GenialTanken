import { parseFrenchRecords } from './french-record.schema.js';

const recordAt = (id: number, geom: { lon: number; lat: number }) => ({
  id,
  adresse: '36 Quai de la Rapée',
  ville: 'Paris',
  cp: '75012',
  geom,
  horaires: null,
  e10_prix: 2.152,
});

describe('parseFrenchRecords', () => {
  it.each([
    ['a latitude above 90', { lon: 2.373, lat: 488.42 }],
    ['a latitude below -90', { lon: 2.373, lat: -90.5 }],
    ['a longitude above 180', { lon: 237.3, lat: 48.842 }],
    ['a longitude below -180', { lon: -180.1, lat: 48.842 }],
  ])('drops a record with %s and keeps the valid ones', (_description, geom) => {
    const { records, skippedRecordCount } = parseFrenchRecords([
      recordAt(1, { lon: 2.373, lat: 48.842 }),
      recordAt(2, geom),
      recordAt(3, { lon: 2.3, lat: 48.84 }),
    ]);

    expect(records.map(record => record.id)).toEqual([1, 3]);
    expect(skippedRecordCount).toBe(1);
  });

  it('keeps the fields the app uses and strips the others', () => {
    const { records } = parseFrenchRecords([
      { ...recordAt(1, { lon: 2.373, lat: 48.842 }), services: null },
    ]);

    expect(records).toEqual([recordAt(1, { lon: 2.373, lat: 48.842 })]);
  });
});
