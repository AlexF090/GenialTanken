import type {
  KeyboardAwareWindow,
  ObservedVisualViewport,
  VisualViewportEventType,
} from '../app/core/layout/visual-viewport';

class FakeObservedVisualViewport implements ObservedVisualViewport {
  height: number;
  offsetTop = 0;
  scale = 1;
  readonly listeners = new Map<VisualViewportEventType, Set<() => void>>();

  constructor(height: number) {
    this.height = height;
  }

  addEventListener(type: VisualViewportEventType, listener: () => void): void {
    const listeners = this.listeners.get(type) ?? new Set();
    listeners.add(listener);
    this.listeners.set(type, listeners);
  }

  removeEventListener(type: VisualViewportEventType, listener: () => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  dispatch(type: VisualViewportEventType): void {
    for (const listener of this.listeners.get(type) ?? []) {
      listener();
    }
  }

  get listenerCount(): number {
    return [...this.listeners.values()].reduce((count, listeners) => count + listeners.size, 0);
  }
}

/**
 * Window whose visual viewport tests resize, e.g. to open an on-screen keyboard that covers its
 * lower part. The layout viewport keeps its height, like in Safari on iOS.
 */
export class FakeKeyboardAwareWindow implements KeyboardAwareWindow {
  readonly visualViewport: FakeObservedVisualViewport;
  scrollY = 0;
  readonly scrollCalls: [number, number][] = [];

  constructor(readonly innerHeight: number) {
    this.visualViewport = new FakeObservedVisualViewport(innerHeight);
  }

  scrollTo(x: number, y: number): void {
    this.scrollCalls.push([x, y]);
    this.scrollY = y;
  }

  /**
   * Shows a keyboard of the given height. iOS may also scroll the visual viewport down
   * (`offsetTop`), which it reports with a `scroll` event after the `resize`.
   */
  openKeyboard(heightInPixels: number, offsetTop = 0): void {
    this.visualViewport.height = this.innerHeight - heightInPixels;
    this.visualViewport.offsetTop = offsetTop;
    this.visualViewport.dispatch('resize');
    if (offsetTop !== 0) {
      this.visualViewport.dispatch('scroll');
    }
  }

  closeKeyboard(): void {
    this.visualViewport.height = this.innerHeight;
    this.visualViewport.offsetTop = 0;
    this.visualViewport.dispatch('resize');
  }

  /** Pinch-zooms by `scale` and pans down by `offsetTop`, without a keyboard. */
  pinchZoom(scale: number, offsetTop = 0): void {
    this.visualViewport.scale = scale;
    this.visualViewport.height = this.innerHeight / scale;
    this.visualViewport.offsetTop = offsetTop;
    this.visualViewport.dispatch('resize');
    this.visualViewport.dispatch('scroll');
  }
}
