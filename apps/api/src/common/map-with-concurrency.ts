/**
 * Maps items with an async function, running at most `limit` calls at once, e.g. to keep the
 * number of parallel requests to a data source polite. Keeps the order of the items.
 *
 * Rejects with a `RangeError` when the limit is not a positive integer, else with the first error
 * of a call. Calls already running then finish unobserved, but no worker starts another one, so a
 * failure does not keep requesting the remaining items.
 */
export const mapWithConcurrency = async <Item, Result>(
  items: readonly Item[],
  limit: number,
  map: (item: Item) => Promise<Result>
): Promise<Result[]> => {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError(`The concurrency limit must be a positive integer, got ${String(limit)}.`);
  }
  const results = new Array<Result>(items.length);
  // One iterator shared by all workers: each entry is taken by exactly one of them.
  const entries = items.entries();
  let hasFailed = false;
  const worker = async (): Promise<void> => {
    for (const [index, item] of entries) {
      if (hasFailed) {
        return;
      }
      try {
        results[index] = await map(item);
      } catch (error) {
        hasFailed = true;
        throw error;
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
