import { afterEach } from 'vitest';
import { installDialogPolyfill } from './dialog-polyfill';
import { FakeResizeObserver } from './fake-resize-observer';

installDialogPolyfill();

// Runs before every spec file: tests share one module graph (Vitest without isolation), so
// static state of test doubles would otherwise leak into the next test.
afterEach(() => {
  FakeResizeObserver.latest = undefined;
});
