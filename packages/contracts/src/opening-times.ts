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

export const openingTimesSchema = z.object({
  monday: openingDaySchema,
  tuesday: openingDaySchema,
  wednesday: openingDaySchema,
  thursday: openingDaySchema,
  friday: openingDaySchema,
  saturday: openingDaySchema,
  sunday: openingDaySchema,
  publicHoliday: openingDaySchema,
});

export type OpeningTimes = z.infer<typeof openingTimesSchema>;

/** Opening times of a station that publishes none, i.e. closed every day. */
export const emptyOpeningTimes = (): OpeningTimes => ({
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  publicHoliday: [],
});
