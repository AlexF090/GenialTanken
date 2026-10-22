import { afterEach } from 'vitest';
import { FakeResizeObserver } from './fake-resize-observer';

// Runs before every spec file: tests share one module graph (Vitest without isolation), so
// static state of test doubles would otherwise leak into the next test.
afterEach(() => {
  FakeResizeObserver.latest = undefined;
});
