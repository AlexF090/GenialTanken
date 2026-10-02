/**
 * Persistence of the favorite station ids. Backed by localStorage for now; the ROADMAP
 * (phase 2) replaces it with an API-backed implementation.
 */
export abstract class FavoritesRepository {
  abstract load(): readonly string[];
  abstract save(stationIds: readonly string[]): void;
}
