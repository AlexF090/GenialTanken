import {
  afterNextRender,
  assertInInjectionContext,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { observeElementResize } from './observe-element-resize';

/**
 * Height in pixels of an element of the component's view, updated whenever it resizes. Starts at
 * 0 and stays there without `ResizeObserver` (jsdom in unit tests). The observer is disconnected
 * when the component is destroyed. Call it in an injection context, e.g. a field initializer.
 */
export const observeElementHeight = (element: () => HTMLElement): Signal<number> => {
  assertInInjectionContext(observeElementHeight);
  const destroyRef = inject(DestroyRef);
  const heightInPixels = signal(0);
  afterNextRender(() => {
    const observedElement = element();
    observeElementResize(
      [observedElement],
      () => {
        heightInPixels.set(observedElement.offsetHeight);
      },
      destroyRef
    );
  });
  return heightInPixels.asReadonly();
};
