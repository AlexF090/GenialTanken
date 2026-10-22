import { describe, expect, it } from 'vitest';
import { WEEKDAYS, emptyOpeningTimes, openingTimesSchema } from './index.js';

describe('WEEKDAYS', () => {
  it('lists the days from Monday to Sunday', () => {
    expect(WEEKDAYS).toEqual([
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ]);
  });
});

describe('emptyOpeningTimes', () => {
  it('has no interval on any day or public holiday', () => {
    const openingTimes = emptyOpeningTimes();

    expect(openingTimesSchema.parse(openingTimes)).toEqual(openingTimes);
    expect(Object.values(openingTimes).every(day => day.length === 0)).toBe(true);
    expect(Object.keys(openingTimes)).toEqual([...WEEKDAYS, 'publicHoliday']);
  });

  it('returns a new object on every call', () => {
    const openingTimes = emptyOpeningTimes();
    openingTimes.monday.push({ opening: '06:00', closing: '22:00' });

    expect(emptyOpeningTimes().monday).toEqual([]);
  });
});
