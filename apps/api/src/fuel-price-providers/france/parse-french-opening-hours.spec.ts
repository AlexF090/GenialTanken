import { parseFrenchOpeningHours } from './parse-french-opening-hours.js';

const CLOSED_WEEK = {
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  publicHoliday: [],
};

describe('parseFrenchOpeningHours', () => {
  it('reads single and multiple intervals and closed days', () => {
    const openingHours = JSON.stringify({
      '@automate-24-24': '',
      jour: [
        {
          '@id': '1',
          '@nom': 'Lundi',
          '@ferme': '',
          horaire: [
            { '@ouverture': '07.00', '@fermeture': '12.30' },
            { '@ouverture': '14.00', '@fermeture': '19.00' },
          ],
        },
        {
          '@id': '6',
          '@nom': 'Samedi',
          '@ferme': '',
          horaire: { '@ouverture': '08.00', '@fermeture': '18.00' },
        },
        {
          '@id': '7',
          '@nom': 'Dimanche',
          '@ferme': '1',
          horaire: { '@ouverture': '08.00', '@fermeture': '12.00' },
        },
      ],
    });

    expect(parseFrenchOpeningHours(openingHours)).toEqual({
      ...CLOSED_WEEK,
      monday: [
        { opening: '07:00', closing: '12:30' },
        { opening: '14:00', closing: '19:00' },
      ],
      saturday: [{ opening: '08:00', closing: '18:00' }],
    });
  });

  it('opens every day around the clock for a 24/24 automatic pump', () => {
    const allDay = [{ opening: '00:00', closing: '24:00' }];

    expect(parseFrenchOpeningHours(JSON.stringify({ '@automate-24-24': '1' }))).toEqual({
      monday: allDay,
      tuesday: allDay,
      wednesday: allDay,
      thursday: allDay,
      friday: allDay,
      saturday: allDay,
      sunday: allDay,
      publicHoliday: [],
    });
  });

  it('accepts a single day object and single-digit hours', () => {
    const openingHours = JSON.stringify({
      jour: {
        '@id': '3',
        '@ferme': '',
        horaire: { '@ouverture': '6.00', '@fermeture': '21:15' },
      },
    });

    expect(parseFrenchOpeningHours(openingHours)).toEqual({
      ...CLOSED_WEEK,
      wednesday: [{ opening: '06:00', closing: '21:15' }],
    });
  });

  it('skips unknown days and malformed intervals', () => {
    const openingHours = JSON.stringify({
      jour: [
        { '@id': '9', horaire: { '@ouverture': '06.00', '@fermeture': '20.00' } },
        { '@id': '2', horaire: { '@ouverture': 'morning', '@fermeture': '20.00' } },
      ],
    });

    expect(parseFrenchOpeningHours(openingHours)).toEqual(CLOSED_WEEK);
  });

  it.each([
    ['missing', null],
    ['not JSON', '{"jour": ['],
    ['an unexpected shape', '"Lundi 06.00-20.00"'],
  ])('reports no opening times when the value is %s', (_description, openingHours) => {
    expect(parseFrenchOpeningHours(openingHours)).toEqual(CLOSED_WEEK);
  });
});
