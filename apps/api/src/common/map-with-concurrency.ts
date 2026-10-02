/**
 * Maps items with an async function, running at most `limit` calls at once, e.g. to keep the
 * number of parallel requests to a data source polite. Keeps the order of the items.
 */
export const mapWithConcurrency = async <Item, Result>(
  items: readonly Item[],
  limit: number,
  map: (item: Item) => Promise<Result>
): Promise<Result[]> => {
  const results = new Array<Result>(items.length);
  // One iterator shared by all workers: each entry is taken by exactly one of them.
  const entries = items.entries();
  const worker = async (): Promise<void> => {
    for (const [index, item] of entries) {
      results[index] = await map(item);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
};
