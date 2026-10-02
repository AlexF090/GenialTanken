import type { MatchMedia, WatchedMediaQuery } from '../app/core/layout/media-query';

type ChangeListener = (event: { matches: boolean }) => void;

class FakeMediaQuery implements WatchedMediaQuery {
  readonly listeners = new Set<ChangeListener>();

  constructor(public matches: boolean) {}

  addEventListener(_type: 'change', listener: ChangeListener): void {
    this.listeners.add(listener);
  }

  removeEventListener(_type: 'change', listener: ChangeListener): void {
    this.listeners.delete(listener);
  }
}

/** Controllable `matchMedia` for tests: queries start as not matching unless set otherwise. */
export class FakeMatchMedia {
  private readonly queries = new Map<string, FakeMediaQuery>();

  readonly matchMedia: MatchMedia = query => this.queryFor(query);

  constructor(initiallyMatchingQueries: readonly string[] = []) {
    for (const query of initiallyMatchingQueries) {
      this.queries.set(query, new FakeMediaQuery(true));
    }
  }

  /** Changes the result of the query and notifies its listeners like the browser does. */
  setMatches(query: string, matches: boolean): void {
    const mediaQuery = this.queryFor(query);
    mediaQuery.matches = matches;
    for (const listener of mediaQuery.listeners) {
      listener({ matches });
    }
  }

  listenerCount(query: string): number {
    return this.queries.get(query)?.listeners.size ?? 0;
  }

  private queryFor(query: string): FakeMediaQuery {
    let mediaQuery = this.queries.get(query);
    if (mediaQuery === undefined) {
      mediaQuery = new FakeMediaQuery(false);
      this.queries.set(query, mediaQuery);
    }
    return mediaQuery;
  }
}
