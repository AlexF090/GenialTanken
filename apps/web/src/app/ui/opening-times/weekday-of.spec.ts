import { weekdayOf } from './weekday-of';

describe('weekdayOf', () => {
  it.each([
    ['2026-10-04T12:00:00', 'sunday'],
    ['2026-10-05T00:00:00', 'monday'],
    ['2026-10-06T23:59:59', 'tuesday'],
    ['2026-10-07T08:00:00', 'wednesday'],
    ['2026-10-08T08:00:00', 'thursday'],
    ['2026-10-09T08:00:00', 'friday'],
    ['2026-10-10T08:00:00', 'saturday'],
  ])('maps the local date %s to %s', (localDateTime, weekday) => {
    expect(weekdayOf(new Date(localDateTime))).toBe(weekday);
  });
});
