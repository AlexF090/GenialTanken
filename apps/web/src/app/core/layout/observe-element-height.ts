import {
  afterNextRender,
  assertInInjectionContext,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';

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
    if (typeof ResizeObserver !== 'function') {
      return;
    }
    const observedElement = element();
    const observer = new ResizeObserver(() => {
      heightInPixels.set(observedElement.offsetHeight);
    });
    observer.observe(observedElement);
    destroyRef.onDestroy(() => {
      observer.disconnect();
    });
  });
  return heightInPixels.asReadonly();
};
