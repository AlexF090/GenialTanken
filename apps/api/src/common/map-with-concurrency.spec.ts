import { mapWithConcurrency } from './map-with-concurrency.js';

interface Deferred<Value> {
  promise: Promise<Value>;
  resolve: (value: Value) => void;
  reject: (reason: Error) => void;
}

const createDeferredCalls = <Value>() => {
  const calls = new Map<string, Deferred<Value>>();
  const map = (item: string): Promise<Value> => {
    let resolve: Deferred<Value>['resolve'] = () => undefined;
    let reject: Deferred<Value>['reject'] = () => undefined;
    const promise = new Promise<Value>((resolvePromise, rejectPromise) => {
      resolve = resolvePromise;
      reject = rejectPromise;
    });
    calls.set(item, { promise, resolve, reject });
    return promise;
  };
  const callFor = (item: string): Deferred<Value> => {
    const deferred = calls.get(item);
    if (deferred === undefined) {
      throw new Error(`${item} was not started`);
    }
    return deferred;
  };
  return { calls, map, callFor };
};

/** Lets every pending promise callback run, so the workers take their next items. */
const settlePendingCallbacks = () => new Promise<void>(resolve => setImmediate(resolve));

describe('mapWithConcurrency', () => {
  it('keeps the order and never runs more calls at once than the limit', async () => {
    const { calls, map, callFor } = createDeferredCalls<string>();

    const results = mapWithConcurrency(['a', 'b', 'c', 'd'], 2, map);
    await settlePendingCallbacks();
    expect([...calls.keys()]).toEqual(['a', 'b']);

    callFor('b').resolve('B');
    await settlePendingCallbacks();
    expect([...calls.keys()]).toEqual(['a', 'b', 'c']);

    callFor('c').resolve('C');
    await settlePendingCallbacks();
    expect([...calls.keys()]).toEqual(['a', 'b', 'c', 'd']);

    callFor('d').resolve('D');
    callFor('a').resolve('A');
    await expect(results).resolves.toEqual(['A', 'B', 'C', 'D']);
  });

  it('rejects with the error of a failed call and starts no further calls', async () => {
    const { calls, map, callFor } = createDeferredCalls<string>();
    const failure = new Error('station page failed');

    const results = mapWithConcurrency(['a', 'b', 'c', 'd'], 2, map);
    await settlePendingCallbacks();
    callFor('a').reject(failure);
    await expect(results).rejects.toBe(failure);

    callFor('b').resolve('B');
    await settlePendingCallbacks();
    expect([...calls.keys()]).toEqual(['a', 'b']);
  });

  it('handles no items', async () => {
    await expect(mapWithConcurrency([], 3, () => Promise.resolve(1))).resolves.toEqual([]);
  });
});
