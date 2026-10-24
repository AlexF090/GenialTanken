import type { DestroyRef } from '@angular/core';

/**
 * Calls `onResize` whenever one of the elements changes its size, until `destroyRef` is
 * destroyed or the returned function is called. Does nothing without `ResizeObserver` (jsdom in
 * unit tests), so the elements keep the size they had.
 */
export const observeElementResize = (
  elements: readonly Element[],
  onResize: () => void,
  destroyRef: DestroyRef
): (() => void) => {
  if (typeof ResizeObserver !== 'function') {
    return () => undefined;
  }
  const observer = new ResizeObserver(() => {
    onResize();
  });
  for (const element of elements) {
    observer.observe(element);
  }
  const stopOnDestroy = destroyRef.onDestroy(() => {
    observer.disconnect();
  });
  return () => {
    stopOnDestroy();
    observer.disconnect();
  };
};
