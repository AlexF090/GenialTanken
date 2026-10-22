import { Logger } from '@nestjs/common';
import { createCache } from 'cache-manager';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { parseEnvironment } from '../../configuration/environment.js';
import type { EnvironmentVariables } from '../../configuration/environment.js';
import { UpstreamFetcher } from '../../upstream/upstream-fetcher.js';
import { FrenchPriceSnapshot } from './french-price-snapshot.js';

const BASE_URL = 'https://open-data.example';
const REFRESH_INTERVAL_IN_MILLISECONDS = 600_000;
const RETRY_DELAY_IN_MILLISECONDS = 60_000;
const WAIT_BUDGET_IN_MILLISECONDS = 3000;

const recordWithIdentifier = (id: number) => ({
  id,
  adresse: '36 Quai de la Rapée',
  ville: 'Paris',
  cp: '75012',
  geom: { lon: 2.373, lat: 48.842 },
  horaires: null,
  gazole_prix: 2.391,
  e10_prix: 2.152,
});

interface PendingAnswer {
  succeed: (records: unknown) => void;
  fail: (status: number) => void;
  signal: AbortSignal | undefined;
}

let pendingAnswers: PendingAnswer[];
let requestedUrls: string[];

beforeEach(() => {
  vi.useFakeTimers();
  pendingAnswers = [];
  requestedUrls = [];
  vi.spyOn(globalThis, 'fetch').mockImplementation(
    (input, init) =>
      new Promise<Response>((resolve, reject) => {
        requestedUrls.push(input instanceof Request ? input.url : input.toString());
        const signal = init?.signal ?? undefined;
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The request was aborted.', 'AbortError'));
        });
        pendingAnswers.push({
          succeed: records => {
            resolve(Response.json(records));
          },
          fail: status => {
            resolve(new Response(null, { status }));
          },
          signal,
        });
      })
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

const createSnapshot = (variables: EnvironmentVariables = {}) => {
  const configuration = new ApplicationConfiguration(
    parseEnvironment({ FRANCE_FUEL_PRICES_BASE_URL: BASE_URL, ...variables })
  );
  const upstreamFetcher = new UpstreamFetcher(configuration, createCache());
  return { snapshot: new FrenchPriceSnapshot(configuration, upstreamFetcher), upstreamFetcher };
};

const latestAnswer = (): PendingAnswer => {
  const answer = pendingAnswers.at(-1);
  if (answer === undefined) {
    throw new Error('No request to the open data API is pending.');
  }
  return answer;
};

const localIdentifiersIn = async (snapshot: FrenchPriceSnapshot) =>
  (await snapshot.findUsableContent())?.entries.map(({ localIdentifier }) => localIdentifier);

/** Lets a load whose answer arrived finish, without moving the fake clock noticeably. */
const expectLocalIdentifiers = (snapshot: FrenchPriceSnapshot, expected: number[] | undefined) =>
  vi.waitFor(async () => {
    expect(await localIdentifiersIn(snapshot)).toEqual(expected);
  });

describe('FrenchPriceSnapshot', () => {
  let snapshot: FrenchPriceSnapshot;

  afterEach(() => {
    snapshot.onModuleDestroy();
  });

  it('loads the whole dataset at bootstrap with the fields the app uses', async () => {
    ({ snapshot } = createSnapshot());

    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([recordWithIdentifier(75012010)]);

    await expect(localIdentifiersIn(snapshot)).resolves.toEqual([75012010]);
    expect(requestedUrls).toEqual([
      'https://open-data.example/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/exports/json?select=id%2Cadresse%2Cville%2Ccp%2Cgeom%2Choraires%2Cgazole_prix%2Csp95_prix%2Ce10_prix%2Csp98_prix%2Ce85_prix%2Cgplc_prix',
    ]);
  });

  it('maps every record to a station that can be found by its local identifier', async () => {
    ({ snapshot } = createSnapshot());

    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([recordWithIdentifier(75012010), recordWithIdentifier(75015001)]);

    const content = await snapshot.findUsableContent();
    expect(content?.entriesByLocalIdentifier.get(75015001)?.station).toEqual(
      expect.objectContaining({ id: 'fr-75015001', distanceInMeters: null })
    );
    expect(content?.entriesByLocalIdentifier.has(1)).toBe(false);
  });

  it('skips malformed records', async () => {
    ({ snapshot } = createSnapshot());

    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([{ id: 'broken' }, recordWithIdentifier(75012010)]);

    await expect(localIdentifiersIn(snapshot)).resolves.toEqual([75012010]);
  });

  it('lets concurrent callers share the load in progress', async () => {
    ({ snapshot } = createSnapshot());

    snapshot.onApplicationBootstrap();
    const contents = [snapshot.findUsableContent(), snapshot.findUsableContent()];
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await Promise.all(contents);

    expect(requestedUrls).toHaveLength(1);
  });

  it('gives callers up after the wait budget while the load goes on', async () => {
    ({ snapshot } = createSnapshot());
    snapshot.onApplicationBootstrap();

    const content = snapshot.findUsableContent();
    await vi.advanceTimersByTimeAsync(WAIT_BUDGET_IN_MILLISECONDS);

    await expect(content).resolves.toBeUndefined();
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await expect(localIdentifiersIn(snapshot)).resolves.toEqual([75012010]);
  });

  it('uses the snapshot timeout for the export', () => {
    const created = createSnapshot({ FRANCE_PRICE_SNAPSHOT_TIMEOUT_IN_SECONDS: '45' });
    snapshot = created.snapshot;
    const fetchJson = vi.spyOn(created.upstreamFetcher, 'fetchJson');

    snapshot.onApplicationBootstrap();

    expect(fetchJson).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutInMilliseconds: 45_000 })
    );
  });

  it('has no snapshot when the first load fails', async () => {
    ({ snapshot } = createSnapshot());

    snapshot.onApplicationBootstrap();
    latestAnswer().fail(503);

    await expect(snapshot.findUsableContent()).resolves.toBeUndefined();
  });

  it('retries soon after a failed load while there is no snapshot', async () => {
    ({ snapshot } = createSnapshot());
    snapshot.onApplicationBootstrap();
    latestAnswer().fail(503);
    await expectLocalIdentifiers(snapshot, undefined);

    await vi.advanceTimersByTimeAsync(RETRY_DELAY_IN_MILLISECONDS);
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await expectLocalIdentifiers(snapshot, [75012010]);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_IN_MILLISECONDS);

    expect(requestedUrls).toHaveLength(2);
  });

  it('keeps the last snapshot and the regular interval when a refresh fails', async () => {
    ({ snapshot } = createSnapshot());
    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await expectLocalIdentifiers(snapshot, [75012010]);

    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);
    latestAnswer().fail(500);
    await vi.advanceTimersByTimeAsync(RETRY_DELAY_IN_MILLISECONDS);

    await expect(localIdentifiersIn(snapshot)).resolves.toEqual([75012010]);
    expect(requestedUrls).toHaveLength(2);
  });

  it('loads the dataset again after every refresh interval', async () => {
    ({ snapshot } = createSnapshot());
    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await expectLocalIdentifiers(snapshot, [75012010]);

    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);
    latestAnswer().succeed([recordWithIdentifier(75015001)]);

    await expectLocalIdentifiers(snapshot, [75015001]);
    expect(requestedUrls).toHaveLength(2);
  });

  it('waits for a load in progress when the snapshot has outlived its maximum age', async () => {
    ({ snapshot } = createSnapshot({ FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS: '900' }));
    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await expectLocalIdentifiers(snapshot, [75012010]);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);
    latestAnswer().fail(503);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);

    const usable = localIdentifiersIn(snapshot);
    latestAnswer().succeed([recordWithIdentifier(75015001)]);

    await expect(usable).resolves.toEqual([75015001]);
  });

  it('counts a snapshot older than its maximum age as missing', async () => {
    ({ snapshot } = createSnapshot({ FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS: '900' }));
    snapshot.onApplicationBootstrap();
    latestAnswer().succeed([recordWithIdentifier(75012010)]);
    await expectLocalIdentifiers(snapshot, [75012010]);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);
    latestAnswer().fail(503);
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);
    latestAnswer().fail(503);

    await expectLocalIdentifiers(snapshot, undefined);
  });

  it('warns about a failing open data API', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const error = vi.spyOn(Logger.prototype, 'error');
    ({ snapshot } = createSnapshot());

    snapshot.onApplicationBootstrap();
    latestAnswer().fail(503);
    await expectLocalIdentifiers(snapshot, undefined);

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('responded with status 503'));
    expect(error).not.toHaveBeenCalled();
  });

  it('reports an unexpected failure as an error, not as an upstream hiccup', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const error = vi.spyOn(Logger.prototype, 'error');
    const created = createSnapshot();
    snapshot = created.snapshot;
    vi.spyOn(created.upstreamFetcher, 'fetchJson').mockRejectedValue(
      new TypeError('A programming error')
    );

    snapshot.onApplicationBootstrap();
    await expectLocalIdentifiers(snapshot, undefined);

    expect(error).toHaveBeenCalledWith(expect.stringContaining('TypeError: A programming error'));
    expect(warn).not.toHaveBeenCalled();
  });

  it('aborts the load in progress silently and stops refreshing when the module is destroyed', async () => {
    const warn = vi.spyOn(Logger.prototype, 'warn');
    const error = vi.spyOn(Logger.prototype, 'error');
    ({ snapshot } = createSnapshot());
    snapshot.onApplicationBootstrap();
    const { signal } = latestAnswer();

    snapshot.onModuleDestroy();
    await vi.advanceTimersByTimeAsync(REFRESH_INTERVAL_IN_MILLISECONDS);

    expect(signal?.aborted).toBe(true);
    expect(requestedUrls).toHaveLength(1);
    await expect(snapshot.findUsableContent()).resolves.toBeUndefined();
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
