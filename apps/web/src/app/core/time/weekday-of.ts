import { WEEKDAYS } from '@genialtanken/contracts';
import type { Weekday } from '@genialtanken/contracts';

const DAYS_PER_WEEK = 7;

/** Weekday of the date in the browser's time zone. */
export const weekdayOf = (date: Date): Weekday => {
  // `getDay()` starts the week on Sunday, `WEEKDAYS` on Monday
  const weekday = WEEKDAYS[(date.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK];
  if (weekday === undefined) {
    throw new RangeError(`Invalid date: ${String(date)}`);
  }
  return weekday;
};
