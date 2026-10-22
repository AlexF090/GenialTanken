/**
 * Lets tests report element sizes that jsdom cannot lay out. Install it with
 * `vi.stubGlobal('ResizeObserver', FakeResizeObserver)`; `latest` is the last observer created.
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

  resize(): void {
    this.callback();
  }
}
