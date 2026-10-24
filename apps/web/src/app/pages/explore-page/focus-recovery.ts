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
 * Whenever `content` changes, e.g. a notice closes, moves the focus to `target` after the next
 * render if the focused control went away with the old content (WCAG 2.4.3). Call it in an
 * injection context.
 */
export const recoverFocusWhenChanged = (
  content: Signal<unknown>,
  target: () => HTMLElement | undefined
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
          target()?.focus({ preventScroll: true });
        }
      },
      { injector }
    );
  });
};
