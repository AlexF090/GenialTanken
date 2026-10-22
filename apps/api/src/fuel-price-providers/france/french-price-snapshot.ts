import { MILLISECONDS_PER_MINUTE, MILLISECONDS_PER_SECOND } from '@genialtanken/contracts';
import { Injectable, Logger } from '@nestjs/common';
import type { OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { z } from 'zod';
import { describeError } from '../../common/describe-error.js';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import { UpstreamAbortedError, UpstreamError } from '../../upstream/upstream-error.js';
import { UpstreamFetcher } from '../../upstream/upstream-fetcher.js';
import { FRENCH_RECORD_FIELDS, parseFrenchRecords } from './french-record.schema.js';
import { FRENCH_EXPORT_PATH } from './french-upstream-paths.js';
import { toFrenchStationEntry } from './to-station-from-france.js';
import type { FrenchStationEntry } from './to-station-from-france.js';

export interface FrenchSnapshotContent {
  entries: readonly FrenchStationEntry[];
  entriesByLocalIdentifier: ReadonlyMap<number, FrenchStationEntry>;
  loadedAtInMilliseconds: number;
}

/** The records stay unchecked here; `parseFrenchRecords` validates them one by one. */
const frenchExportSchema = z.array(z.unknown());

/** Short, so a restarted instance whose first load failed soon serves from memory again. */
const RETRY_DELAY_IN_MILLISECONDS = MILLISECONDS_PER_MINUTE;

/**
 * How long a request without usable snapshot waits for a load in progress before it asks the open
 * data API itself; the load keeps going in the background.
 */
const MAXIMUM_WAIT_FOR_LOAD_IN_MILLISECONDS = 3 * MILLISECONDS_PER_SECOND;

/**
 * The whole French dataset in memory, so searches and lookups need no upstream request. It is
 * loaded at bootstrap and again every `FRANCE_PRICE_SNAPSHOT_REFRESH_INTERVAL_IN_SECONDS`, or a
 * minute after a failed load while there is no usable snapshot. A failed refresh keeps the
 * previous snapshot until it is older than `FRANCE_PRICE_SNAPSHOT_MAXIMUM_AGE_IN_SECONDS`.
 */
@Injectable()
export class FrenchPriceSnapshot implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(FrenchPriceSnapshot.name);
  private readonly shutdown = new AbortController();
  private content: FrenchSnapshotContent | undefined;
  private loadInProgress: Promise<void> | undefined;
  private nextLoadTimer: NodeJS.Timeout | undefined;

  constructor(
    private readonly configuration: ApplicationConfiguration,
    private readonly upstreamFetcher: UpstreamFetcher
  ) {}

  /** Does not wait for the load, so the application listens (and passes health checks) at once. */
  onApplicationBootstrap(): void {
    this.startLoad();
  }

  onModuleDestroy(): void {
    clearTimeout(this.nextLoadTimer);
    this.shutdown.abort();
  }

  /**
   * The snapshot if it is recent enough; else waits a little for a load in progress, e.g. the one
   * started at bootstrap. `undefined` means the caller has to ask the open data API itself.
   */
  async findUsableContent(): Promise<FrenchSnapshotContent | undefined> {
    if (!this.isUsable(this.content) && this.loadInProgress !== undefined) {
      await this.waitAtMostTheBudgetFor(this.loadInProgress);
    }
    return this.isUsable(this.content) ? this.content : undefined;
  }

  /** The next load is only scheduled once this one settled, so loads never overlap. */
  private startLoad(): void {
    this.loadInProgress = this.load().finally(() => {
      this.loadInProgress = undefined;
      this.scheduleNextLoad();
    });
  }

  private scheduleNextLoad(): void {
    if (this.shutdown.signal.aborted) {
      return;
    }
    const delayInMilliseconds = this.isUsable(this.content)
      ? this.configuration.francePriceSnapshotRefreshIntervalInMilliseconds
      : RETRY_DELAY_IN_MILLISECONDS;
    this.nextLoadTimer = setTimeout(() => {
      this.startLoad();
    }, delayInMilliseconds);
    // The timer alone must not keep the process alive, e.g. after a failed shutdown.
    this.nextLoadTimer.unref();
  }

  private async waitAtMostTheBudgetFor(load: Promise<void>): Promise<void> {
    let budgetTimer: NodeJS.Timeout | undefined;
    const budget = new Promise<void>(resolve => {
      budgetTimer = setTimeout(resolve, MAXIMUM_WAIT_FOR_LOAD_IN_MILLISECONDS);
    });
    try {
      await Promise.race([load, budget]);
    } finally {
      clearTimeout(budgetTimer);
    }
  }

  private isUsable(content: FrenchSnapshotContent | undefined): content is FrenchSnapshotContent {
    return (
      content !== undefined &&
      Date.now() - content.loadedAtInMilliseconds <=
        this.configuration.francePriceSnapshotMaximumAgeInMilliseconds
    );
  }

  /** Never rejects: a background load has no caller to report to. */
  private async load(): Promise<void> {
    const url = new URL(`${this.configuration.franceFuelPricesBaseUrl}${FRENCH_EXPORT_PATH}`);
    url.search = new URLSearchParams({ select: FRENCH_RECORD_FIELDS.join(',') }).toString();
    try {
      const results = await this.upstreamFetcher.fetchJson({
        url,
        schema: frenchExportSchema,
        bypassesCache: true,
        timeoutInMilliseconds: this.configuration.francePriceSnapshotTimeoutInMilliseconds,
        signal: this.shutdown.signal,
      });
      const { records, skippedRecordCount } = parseFrenchRecords(results);
      if (skippedRecordCount > 0) {
        this.logger.warn(
          `Skipped ${String(skippedRecordCount)} malformed French fuel price records`
        );
      }
      const entries = records.map(toFrenchStationEntry);
      this.content = {
        entries,
        entriesByLocalIdentifier: new Map(entries.map(entry => [entry.localIdentifier, entry])),
        loadedAtInMilliseconds: Date.now(),
      };
      this.logger.log(`Loaded ${String(entries.length)} French stations`);
    } catch (error) {
      // Only the shutdown aborts a load.
      if (error instanceof UpstreamAbortedError) {
        return;
      }
      if (error instanceof UpstreamError) {
        this.logger.warn(`Could not refresh the French price snapshot: ${describeError(error)}`);
        return;
      }
      this.logger.error(`Failed to refresh the French price snapshot: ${describeError(error)}`);
    }
  }
}
