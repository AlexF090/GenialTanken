import type { Place } from '@genialtanken/contracts';

/** Spelling variants of the same search share one upstream request and cache entry. */
export const normalizePlaceQuery = (query: string): string =>
  query.trim().replace(/\s+/g, ' ').toLowerCase();

/** Usable places in upstream order, each identifier once, at most `limit`. */
export const selectPlaces = (candidates: readonly (Place | null)[], limit: number): Place[] => {
  const placesByIdentifier = new Map<string, Place>();
  for (const candidate of candidates) {
    if (candidate !== null && !placesByIdentifier.has(candidate.id)) {
      placesByIdentifier.set(candidate.id, candidate);
    }
  }
  return [...placesByIdentifier.values()].slice(0, limit);
};
