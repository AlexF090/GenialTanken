import { mapWithConcurrency } from './map-with-concurrency.js';

describe('mapWithConcurrency', () => {
  it('keeps the order and never runs more calls at once than the limit', async () => {
    let running = 0;
    let mostRunning = 0;
    const results = await mapWithConcurrency([30, 10, 20, 0, 5], 2, async delay => {
      running += 1;
      mostRunning = Math.max(mostRunning, running);
      await new Promise(resolve => setTimeout(resolve, delay));
      running -= 1;
      return delay * 2;
    });

    expect(results).toEqual([60, 20, 40, 0, 10]);
    expect(mostRunning).toBe(2);
  });

  it('handles no items', async () => {
    await expect(mapWithConcurrency([], 3, () => Promise.resolve(1))).resolves.toEqual([]);
  });
});
