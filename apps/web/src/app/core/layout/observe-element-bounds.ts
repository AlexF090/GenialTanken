import {
  afterNextRender,
  assertInInjectionContext,
  DestroyRef,
  DOCUMENT,
  inject,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';
import { observeElementResize } from './observe-element-resize';

/** Edges of an element in pixels from the top left corner of the window. */
export interface ElementBounds {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

const NO_BOUNDS: ElementBounds = { top: 0, right: 0, bottom: 0, left: 0 };

const isSameBounds = (first: ElementBounds, second: ElementBounds): boolean =>
  first.top === second.top &&
  first.right === second.right &&
  first.bottom === second.bottom &&
  first.left === second.left;

/**
 * Where an element of the component's view lies in the window, updated whenever it or the window
 * resizes (an element fixed to the window moves only then). Starts at 0 on every edge and stays
 * there without `ResizeObserver` (jsdom in unit tests). Call it in an injection context.
 */
export const observeElementBounds = (element: () => HTMLElement): Signal<ElementBounds> => {
  assertInInjectionContext(observeElementBounds);
  const destroyRef = inject(DestroyRef);
  const document = inject(DOCUMENT);
  const bounds = signal(NO_BOUNDS, { equal: isSameBounds });
  afterNextRender(() => {
    const observedElement = element();
    observeElementResize(
      [observedElement, document.documentElement],
      () => {
        const { top, right, bottom, left } = observedElement.getBoundingClientRect();
        bounds.set({ top, right, bottom, left });
      },
      destroyRef
    );
  });
  return bounds.asReadonly();
};
