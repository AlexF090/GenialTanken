import {
  assertInInjectionContext,
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
  signal,
} from '@angular/core';
import type { Signal } from '@angular/core';

export type VisualViewportEventType = 'resize' | 'scroll';

/** The part of `window.visualViewport` the app relies on, so tests can provide a small fake. */
export interface ObservedVisualViewport {
  readonly height: number;
  readonly offsetTop: number;
  addEventListener(type: VisualViewportEventType, listener: () => void): void;
  removeEventListener(type: VisualViewportEventType, listener: () => void): void;
}

/** The window seen through its visual viewport, the part not covered by an on-screen keyboard. */
export interface KeyboardAwareWindow {
  readonly visualViewport: ObservedVisualViewport;
  /** Height of the layout viewport, which the page's fixed elements fill. */
  readonly innerHeight: number;
  readonly scrollY: number;
  scrollTo(x: number, y: number): void;
}

/** The browser window; `null` where it has no visual viewport (server, jsdom, old browsers). */
export const KEYBOARD_AWARE_WINDOW = new InjectionToken<KeyboardAwareWindow | null>(
  'KeyboardAwareWindow',
  {
    providedIn: 'root',
    factory: () => {
      const window = inject(DOCUMENT).defaultView;
      const visualViewport = window?.visualViewport ?? null;
      if (window === null || visualViewport === null) {
        return null;
      }
      return {
        visualViewport,
        get innerHeight() {
          return window.innerHeight;
        },
        get scrollY() {
          return window.scrollY;
        },
        scrollTo: (x, y) => {
          window.scrollTo(x, y);
        },
      };
    },
  }
);

/** Custom property on the root element: pixels of the window an on-screen keyboard covers. */
export const KEYBOARD_INSET_PROPERTY = '--layout-keyboard-inset';

/**
 * How much of the layout viewport lies below the visual viewport: the on-screen keyboard where
 * the browser does not resize the layout for it (Safari on iOS). With
 * `interactive-widget=resizes-content` (Chrome on Android) the layout shrinks and this stays 0.
 */
export const keyboardInsetFor = (
  layoutHeight: number,
  visualViewport: Pick<ObservedVisualViewport, 'height' | 'offsetTop'>
): number =>
  Math.max(Math.round(layoutHeight - visualViewport.height - visualViewport.offsetTop), 0);

const TEXT_FIELD_SELECTOR = 'input, textarea, [contenteditable]:not([contenteditable="false"])';

/**
 * Follows the on-screen keyboard: returns the covered height and writes it to
 * `--layout-keyboard-inset`, so scrolling content can pad its end above the keyboard. Safari on
 * iOS also scrolls the whole page up to reveal a focused field, although the page is fixed to the
 * window; that is scrolled back, so the sheet stays where it is. Call it in an injection context;
 * it stops when the injector is destroyed.
 */
export const injectKeyboardInset = (): Signal<number> => {
  assertInInjectionContext(injectKeyboardInset);
  const window = inject(KEYBOARD_AWARE_WINDOW);
  const inset = signal(0);
  if (window === null) {
    return inset.asReadonly();
  }
  const document = inject(DOCUMENT);
  const rootStyle = document.documentElement.style;
  const visualViewport = window.visualViewport;

  const updateInset = (): void => {
    inset.set(keyboardInsetFor(window.innerHeight, visualViewport));
    rootStyle.setProperty(KEYBOARD_INSET_PROPERTY, `${String(inset())}px`);
  };
  const scrollPageBack = (): void => {
    const isTextFieldFocused = document.activeElement?.matches(TEXT_FIELD_SELECTOR) === true;
    if (isTextFieldFocused && window.scrollY !== 0) {
      window.scrollTo(0, 0);
    }
    updateInset();
  };

  updateInset();
  visualViewport.addEventListener('resize', updateInset);
  visualViewport.addEventListener('scroll', scrollPageBack);
  inject(DestroyRef).onDestroy(() => {
    visualViewport.removeEventListener('resize', updateInset);
    visualViewport.removeEventListener('scroll', scrollPageBack);
    rootStyle.removeProperty(KEYBOARD_INSET_PROPERTY);
  });
  return inset.asReadonly();
};
