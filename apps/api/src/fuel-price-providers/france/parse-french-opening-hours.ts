import type { OpeningTimes } from '@genialtanken/contracts';
import { z } from 'zod';

type Weekday = Exclude<keyof OpeningTimes, 'publicHoliday'>;

interface OpeningInterval {
  opening: string;
  closing: string;
}

const WEEKDAYS_BY_FRENCH_DAY_NUMBER: Readonly<Record<string, Weekday>> = {
  '1': 'monday',
  '2': 'tuesday',
  '3': 'wednesday',
  '4': 'thursday',
  '5': 'friday',
  '6': 'saturday',
  '7': 'sunday',
};

const FLAG_SET = '1';
const ALL_DAY: OpeningInterval = { opening: '00:00', closing: '24:00' };
const MIDNIGHT = '00:00';
const TIME_PATTERN = /^(\d{1,2})[.:](\d{2})$/;

const intervalSchema = z.object({ '@ouverture': z.string(), '@fermeture': z.string() });

const daySchema = z.object({
  '@id': z.string(),
  '@ferme': z.string().optional(),
  horaire: z.union([intervalSchema, z.array(intervalSchema)]).optional(),
});

const openingHoursSchema = z.object({
  '@automate-24-24': z.string().optional(),
  jour: z.unknown().optional(),
});

const emptyOpeningTimes = (): OpeningTimes => ({
  monday: [],
  tuesday: [],
  wednesday: [],
  thursday: [],
  friday: [],
  saturday: [],
  sunday: [],
  publicHoliday: [],
});

const toTime = (frenchTime: string): string | null => {
  const match = TIME_PATTERN.exec(frenchTime.trim());
  if (match === null) {
    return null;
  }
  const [, hours = '', minutes = ''] = match;
  return `${hours.padStart(2, '0')}:${minutes}`;
};

const toIntervals = (horaire: z.infer<typeof daySchema>['horaire']): OpeningInterval[] => {
  const intervals = Array.isArray(horaire) ? horaire : horaire === undefined ? [] : [horaire];
  return intervals.flatMap(interval => {
    const opening = toTime(interval['@ouverture']);
    const closing = toTime(interval['@fermeture']);
    if (opening === null || closing === null) {
      return [];
    }
    // The dataset encodes "open around the clock" as an interval from midnight to midnight
    if (opening === MIDNIGHT && closing === MIDNIGHT) {
      return [ALL_DAY];
    }
    return [{ opening, closing }];
  });
};

const parseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return undefined;
    }
    throw error;
  }
};

/**
 * Parses the JSON-encoded `horaires` field of the French dataset. Unknown or malformed parts
 * are treated as closed, since the dataset is not consistently filled.
 */
export const parseFrenchOpeningHours = (horaires: string | null | undefined): OpeningTimes => {
  const openingTimes = emptyOpeningTimes();
  if (horaires === null || horaires === undefined) {
    return openingTimes;
  }
  const parsed = openingHoursSchema.safeParse(parseJson(horaires));
  if (!parsed.success) {
    return openingTimes;
  }

  if (parsed.data['@automate-24-24'] === FLAG_SET) {
    for (const weekday of Object.values(WEEKDAYS_BY_FRENCH_DAY_NUMBER)) {
      openingTimes[weekday] = [ALL_DAY];
    }
    return openingTimes;
  }

  const { jour } = parsed.data;
  const days = Array.isArray(jour) ? jour : [jour];
  for (const day of days) {
    const parsedDay = daySchema.safeParse(day);
    if (!parsedDay.success || parsedDay.data['@ferme'] === FLAG_SET) {
      continue;
    }
    const weekday = WEEKDAYS_BY_FRENCH_DAY_NUMBER[parsedDay.data['@id']];
    if (weekday !== undefined) {
      openingTimes[weekday] = toIntervals(parsedDay.data.horaire);
    }
  }
  return openingTimes;
};
