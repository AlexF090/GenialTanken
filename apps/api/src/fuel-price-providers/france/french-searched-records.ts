import { CacheableMemory } from '@cacheable/memory';
import { Injectable } from '@nestjs/common';
import { ApplicationConfiguration } from '../../configuration/application-configuration.js';
import type { FrenchRecord } from './french-record.schema.js';

interface SearchedRecord {
  record: FrenchRecord;
  /** `Date.now()` when the upstream answered the search that contained the record. */
  fetchedAt: number;
}

/**
 * Records of recent search answers by identifier, so a detail or favorites lookup of a listed
 * station needs no upstream request. A record lives at most the cache time to live after its
 * fetch, like the search answer itself. The store is separate from the shared cache, so the many
 * short-lived records of a search never evict long-lived station identities or places.
 */
@Injectable()
export class FrenchSearchedRecords {
  private readonly records: CacheableMemory;

  constructor(private readonly configuration: ApplicationConfiguration) {
    this.records = new CacheableMemory({
      lruSize: configuration.franceSearchedRecordsMaximumEntries,
    });
  }

  /** A search answer served from the cache must not replace records of a newer one. */
  remember(records: readonly FrenchRecord[], fetchedAt: number): void {
    const remainingTimeToLiveInMilliseconds =
      fetchedAt + this.configuration.cacheTimeToLiveInMilliseconds - Date.now();
    if (remainingTimeToLiveInMilliseconds <= 0) {
      return;
    }
    for (const record of records) {
      const key = String(record.id);
      const remembered = this.records.get<SearchedRecord>(key);
      if (remembered !== undefined && remembered.fetchedAt >= fetchedAt) {
        continue;
      }
      this.records.set(key, { record, fetchedAt }, remainingTimeToLiveInMilliseconds);
    }
  }

  find(localIdentifier: string): FrenchRecord | undefined {
    return this.records.get<SearchedRecord>(localIdentifier)?.record;
  }
}
