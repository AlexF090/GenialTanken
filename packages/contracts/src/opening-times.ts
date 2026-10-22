import * as z from 'zod';

export const WEEKDAYS = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

/** Times as `HH:MM`; `24:00` closes a day that is open until midnight. */
export const openingIntervalSchema = z.object({
  opening: z.string(),
  closing: z.string(),
});

export type OpeningInterval = z.infer<typeof openingIntervalSchema>;

const openingDaySchema = z.array(openingIntervalSchema);

const OPENING_DAYS = [...WEEKDAYS, 'publicHoliday'] as const;

/** Every weekday and the public holiday, each with its intervals; other keys are rejected. */
export const openingTimesSchema = z.record(z.enum(OPENING_DAYS), openingDaySchema);

export type OpeningTimes = z.infer<typeof openingTimesSchema>;

/** Opening times of a station that publishes none, i.e. closed every day. */
export const emptyOpeningTimes = (): OpeningTimes =>
  // Parsing proves to the compiler that no day is missing, without a type assertion.
  openingTimesSchema.parse(Object.fromEntries(OPENING_DAYS.map(day => [day, []])));
