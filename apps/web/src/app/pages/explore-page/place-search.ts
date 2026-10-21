import {
  assertInInjectionContext,
  computed,
  debounced,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import type { Place } from '@genialtanken/contracts';
import { PlacesApi } from '../../core/places/places-api';
import { describePlacesError } from '../../core/places/places-error-message';
import { SearchCenterStore } from '../../core/search-center/search-center-store';

/** Waiting for a typing pause keeps the place search from firing on every keystroke. */
export const PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS = 300;

const NO_MATCHING_PLACES_MESSAGE = 'Keine passenden Orte gefunden.';

const waitForTypingPause = (query: string | undefined): Promise<void> | undefined =>
  query === undefined
    ? undefined
    : new Promise(resolve => setTimeout(resolve, PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS));

/** State of the place search field; choosing a place moves the search center there. */
export interface PlaceSearch {
  /** Text in the search field: the chosen place, or what the user is typing. */
  readonly query: Signal<string>;
  readonly suggestions: Signal<readonly Place[]>;
  /** Why there are no suggestions, e.g. no match or an unavailable search. */
  readonly statusMessage: Signal<string | undefined>;
  search(query: string): void;
  choose(place: Place): void;
  /** Keeps the stations around the same point, just without the place name. */
  clear(): void;
}

/**
 * Searches places for the typed text after a typing pause. Call it in an injection context,
 * e.g. a field initializer of the page.
 */
export const injectPlaceSearch = (): PlaceSearch => {
  assertInInjectionContext(injectPlaceSearch);
  const searchCenter = inject(SearchCenterStore);
  const center = searchCenter.center;

  const query = linkedSignal(() => {
    const currentCenter = center();
    return currentCenter.source === 'place' ? currentCenter.label : '';
  });
  /** Only typed text is searched, not the name of a place that was just chosen. */
  const isTyping = signal(false);
  const queryAfterTypingPause = debounced(
    () => (isTyping() ? query() : undefined),
    waitForTypingPause
  );
  const placesResource = inject(PlacesApi).placesMatching(() =>
    queryAfterTypingPause.hasValue() ? queryAfterTypingPause.value() : undefined
  );

  return {
    query: query.asReadonly(),
    suggestions: computed<readonly Place[]>(() =>
      isTyping() && placesResource.hasValue() ? placesResource.value() : []
    ),
    statusMessage: computed(() => {
      if (!isTyping()) {
        return undefined;
      }
      const error = placesResource.error();
      if (error !== undefined) {
        return describePlacesError(error);
      }
      const hasNoMatches =
        placesResource.status() === 'resolved' && placesResource.value()?.length === 0;
      return hasNoMatches ? NO_MATCHING_PLACES_MESSAGE : undefined;
    }),
    search: typedQuery => {
      query.set(typedQuery);
      isTyping.set(true);
    },
    choose: place => {
      isTyping.set(false);
      searchCenter.usePlace(place);
    },
    clear: () => {
      isTyping.set(false);
      if (center().source === 'place') {
        searchCenter.useMapArea(center());
      }
    },
  };
};
