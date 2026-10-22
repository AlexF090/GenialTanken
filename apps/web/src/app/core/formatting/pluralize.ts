/** Chooses the German singular for exactly one, the plural otherwise (also for zero). */
export const pluralize = (count: number, singular: string, plural: string): string =>
  count === 1 ? singular : plural;
