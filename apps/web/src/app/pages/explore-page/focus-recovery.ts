import {
  afterNextRender,
  assertInInjectionContext,
  DOCUMENT,
  effect,
  inject,
  Injector,
} from '@angular/core';
import type { Signal } from '@angular/core';

/** Whether the focus fell back to the body, e.g. because the focused control was removed. */
export const isFocusLost = (document: Document): boolean =>
  document.activeElement === null || document.activeElement === document.body;

/**
 * Whenever `content` changes, e.g. a notice closes, calls `focusTarget` after the next render if
 * the focused control went away with the old content (WCAG 2.4.3). Call it in an injection
 * context.
 */
export const recoverFocusWhenChanged = (
  content: Signal<unknown>,
  focusTarget: () => void
): void => {
  assertInInjectionContext(recoverFocusWhenChanged);
  const document = inject(DOCUMENT);
  const injector = inject(Injector);
  let isFirstRun = true;
  effect(() => {
    content();
    if (isFirstRun) {
      isFirstRun = false;
      return;
    }
    afterNextRender(
      () => {
        if (isFocusLost(document)) {
          focusTarget();
        }
      },
      { injector }
    );
  });
};
