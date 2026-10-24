import {
  assertInInjectionContext,
  DestroyRef,
  DOCUMENT,
  inject,
  InjectionToken,
} from '@angular/core';
import { keyboardInsetFor } from './visual-viewport';
import type { ObservedVisualViewport } from './visual-viewport';

export interface ScreenSize {
  readonly width: number;
  readonly height: number;
}

/** The window of an app opened from the home screen of iOS; the part the gap is measured from. */
export interface StandaloneWindow {
  readonly screen: ScreenSize;
  readonly innerWidth: number;
  readonly innerHeight: number;
  readonly visualViewport: ObservedVisualViewport;
}

/**
 * The browser window inside an app opened from the home screen of iOS, the only place with the
 * gap; `null` everywhere else. Only iOS knows `navigator.standalone`, and it is `true` there.
 */
export const STANDALONE_WINDOW = new InjectionToken<StandaloneWindow | null>('StandaloneWindow', {
  providedIn: 'root',
  factory: () => {
    const window = inject(DOCUMENT).defaultView;
    const visualViewport = window?.visualViewport ?? null;
    if (
      window === null ||
      visualViewport === null ||
      Reflect.get(window.navigator, 'standalone') !== true
    ) {
      return null;
    }
    return {
      screen: window.screen,
      visualViewport,
      get innerWidth() {
        return window.innerWidth;
      },
      get innerHeight() {
        return window.innerHeight;
      },
    };
  },
});

/** Custom property on the root element: pixels of the screen below the layout viewport. */
export const VIEWPORT_GAP_BOTTOM_PROPERTY = '--layout-viewport-gap-bottom';

/** The gaps iOS leaves are about 60 px; anything larger is something else, e.g. a keyboard. */
const MAXIMUM_GAP_IN_PIXELS = 120;

/**
 * How far the layout viewport ends above the bottom of the screen. iOS 26 leaves such a gap in
 * apps opened from the home screen, from the start or after the keyboard first opened, so
 * everything fixed to the window stops short of the bottom edge. `screen` keeps its portrait
 * size in landscape, hence the shorter side there.
 */
export const viewportGapBottomFor = (screen: ScreenSize, layout: ScreenSize): number => {
  const screenHeight =
    layout.width > layout.height
      ? Math.min(screen.width, screen.height)
      : Math.max(screen.width, screen.height);
  const gap = Math.round(screenHeight - layout.height);
  return gap >= 1 && gap <= MAXIMUM_GAP_IN_PIXELS ? gap : 0;
};

/**
 * Writes the gap below the layout viewport to `--layout-viewport-gap-bottom`, so the page and
 * its sheets reach the bottom of the screen again. Measured while no keyboard is open (the
 * keyboard inset stays apart from the gap), again on every resize, e.g. when the keyboard closed
 * or the screen turned, and when the app returns to the foreground. Call it in an injection
 * context; it stops when the injector is destroyed.
 */
export const injectViewportGapBottom = (): void => {
  assertInInjectionContext(injectViewportGapBottom);
  const window = inject(STANDALONE_WINDOW);
  if (window === null) {
    return;
  }
  const document = inject(DOCUMENT);
  const rootStyle = document.documentElement.style;
  const visualViewport = window.visualViewport;

  const updateGap = (): void => {
    if (keyboardInsetFor(window.innerHeight, visualViewport) > 0) {
      return;
    }
    const gap = viewportGapBottomFor(window.screen, {
      width: window.innerWidth,
      height: window.innerHeight,
    });
    rootStyle.setProperty(VIEWPORT_GAP_BOTTOM_PROPERTY, `${String(gap)}px`);
  };

  updateGap();
  visualViewport.addEventListener('resize', updateGap);
  document.addEventListener('visibilitychange', updateGap);
  inject(DestroyRef).onDestroy(() => {
    visualViewport.removeEventListener('resize', updateGap);
    document.removeEventListener('visibilitychange', updateGap);
    rootStyle.removeProperty(VIEWPORT_GAP_BOTTOM_PROPERTY);
  });
};
