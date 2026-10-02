import type { OpeningTimes } from '@genialtanken/contracts';

export type Weekday = Exclude<keyof OpeningTimes, 'publicHoliday'>;

/** Indexed by `Date.prototype.getDay()`, which starts the week on Sunday. */
const WEEKDAYS_FROM_SUNDAY: readonly Weekday[] = [
  'sunday',
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
];

/** Weekday of the date in the browser's time zone. */
export const weekdayOf = (date: Date): Weekday => {
  const weekday = WEEKDAYS_FROM_SUNDAY[date.getDay()];
  if (weekday === undefined) {
    throw new RangeError(`Invalid date: ${String(date)}`);
  }
  return weekday;
};
