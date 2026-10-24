import {
  afterNextRender,
  assertInInjectionContext,
  DOCUMENT,
  inject,
  Injector,
  signal,
} from '@angular/core';
import type { Signal, WritableSignal } from '@angular/core';
import { TOUCH_DEVICE_MEDIA_QUERY } from '../../core/installation/installation-hint';
import { injectMediaQueryMatches } from '../../core/layout/media-query';
import { Viewport } from '../../core/layout/viewport';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import { isFocusLost } from './focus-recovery';

export interface SearchModeOptions {
  snapPosition: WritableSignal<SnapPosition>;
  /**
   * Where the focus goes when the search ends and the field must not keep it: on touch devices,
   * where moving it away dismisses the on-screen keyboard like in Apple Maps, and when the
   * focused "Abbrechen" went away.
   */
  focusAfterSearch: () => void;
}

/**
 * While the field of the place search is in use, its suggestions replace the list, like in Apple
 * Maps; on phones the sheet opens fully above the keyboard. Only "Abbrechen", Escape or a chosen
 * place end it, not leaving the field, so dismissing the keyboard keeps the suggestions.
 */
export interface SearchMode {
  readonly isSearching: Signal<boolean>;
  start(): void;
  /** The sheet returns to where it was before the search. */
  cancel(): void;
  /** The sheet steps down to half, so the map shows the stations around the chosen place. */
  finishWithChoice(): void;
}

/** Call it in an injection context. */
export const injectSearchMode = (options: SearchModeOptions): SearchMode => {
  assertInInjectionContext(injectSearchMode);
  const isCompactViewport = inject(Viewport).isCompactViewport;
  const isTouchDevice = injectMediaQueryMatches(TOUCH_DEVICE_MEDIA_QUERY);
  const document = inject(DOCUMENT);
  const injector = inject(Injector);
  const isSearching = signal(false);
  let snapPositionBeforeSearch: SnapPosition = 'half';

  const end = (snapPosition: SnapPosition): void => {
    isSearching.set(false);
    if (isCompactViewport()) {
      options.snapPosition.set(snapPosition);
    }
    afterNextRender(
      () => {
        if (isTouchDevice() || isFocusLost(document)) {
          options.focusAfterSearch();
        }
      },
      { injector }
    );
  };

  return {
    isSearching: isSearching.asReadonly(),
    start: () => {
      if (isSearching()) {
        return;
      }
      isSearching.set(true);
      snapPositionBeforeSearch = options.snapPosition();
      if (isCompactViewport()) {
        options.snapPosition.set('full');
      }
    },
    cancel: () => {
      end(snapPositionBeforeSearch);
    },
    finishWithChoice: () => {
      end('half');
    },
  };
};
