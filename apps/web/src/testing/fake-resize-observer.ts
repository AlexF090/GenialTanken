/**
 * Lets tests report element sizes that jsdom cannot lay out. Install it with
 * `vi.stubGlobal('ResizeObserver', FakeResizeObserver)`; `latest` is the last observer created
 * in the current test (`global-test-setup.ts` forgets it after each test).
 */
export class FakeResizeObserver {
  static latest: FakeResizeObserver | undefined;
  readonly observedElements: Element[] = [];
  isDisconnected = false;

  constructor(private readonly callback: () => void) {
    FakeResizeObserver.latest = this;
  }

  observe(element: Element): void {
    this.observedElements.push(element);
  }

  disconnect(): void {
    this.isDisconnected = true;
  }

  /** Reports a resize like the browser does; a disconnected observer no longer reports one. */
  resize(): void {
    if (this.isDisconnected) {
      throw new Error('The ResizeObserver was disconnected and reports no more resizes');
    }
    this.callback();
  }
}
