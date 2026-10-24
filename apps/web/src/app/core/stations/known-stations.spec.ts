import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';
import type { Station } from '@genialtanken/contracts';
import {
  carrefourStation,
  essoStation,
  totalStation,
  withPrices,
} from '../../../testing/station-fixtures';
import {
  isOutdated,
  KNOWN_STATION_MAXIMUM_AGE_IN_MILLISECONDS,
  KNOWN_STATION_SOURCES,
  KnownStations,
} from './known-stations';
import type { KnownStationSource } from './known-stations';

const NOW = new Date('2026-10-23T12:00:00Z');
const minutesAgo = (minutes: number): Date =>
  new Date(NOW.getTime() - minutes * MILLISECONDS_PER_MINUTE);

const sourceOf = (stations: Station[], loadedAt?: Date) => ({
  stations: signal<readonly Station[]>(stations),
  loadedAt: signal<Date | undefined>(loadedAt),
});

const knownStationsWith = (...sources: KnownStationSource[]): KnownStations => {
  TestBed.configureTestingModule({
    providers: [{ provide: KNOWN_STATION_SOURCES, useValue: sources }],
  });
  return TestBed.inject(KnownStations);
};

describe('KnownStations', () => {
  it('finds a station of any source together with the time that source loaded it', () => {
    const loadedAt = minutesAgo(2);
    const knownStations = knownStationsWith(
      sourceOf([totalStation]),
      sourceOf([essoStation], loadedAt)
    );

    expect(knownStations.find(essoStation.id)).toEqual({ station: essoStation, loadedAt });
    expect(knownStations.find(totalStation.id)).toEqual({
      station: totalStation,
      loadedAt: undefined,
    });
  });

  it('prefers the first source that has the station', () => {
    const fromResults = withPrices(totalStation, { e5: 1.7 });
    const knownStations = knownStationsWith(
      sourceOf([fromResults], minutesAgo(1)),
      sourceOf([totalStation], minutesAgo(30))
    );

    expect(knownStations.find(totalStation.id)?.station).toBe(fromResults);
  });

  it('knows nothing of other stations', () => {
    const knownStations = knownStationsWith(sourceOf([totalStation]), sourceOf([]));

    expect(knownStations.find(carrefourStation.id)).toBeUndefined();
  });

  it('follows the sources as they change', () => {
    const results = sourceOf([totalStation]);
    const knownStations = knownStationsWith(results);

    results.stations.set([carrefourStation]);

    expect(knownStations.find(totalStation.id)).toBeUndefined();
    expect(knownStations.find(carrefourStation.id)?.station).toBe(carrefourStation);
  });
});

describe('isOutdated', () => {
  it('keeps data as long as the API caches its answers', () => {
    expect(KNOWN_STATION_MAXIMUM_AGE_IN_MILLISECONDS).toBe(5 * MILLISECONDS_PER_MINUTE);
    expect(isOutdated({ station: totalStation, loadedAt: minutesAgo(5) }, NOW)).toBe(false);
  });

  it('calls older data outdated', () => {
    expect(isOutdated({ station: totalStation, loadedAt: minutesAgo(5.1) }, NOW)).toBe(true);
  });

  it('cannot tell the age of data without load time and keeps it', () => {
    expect(isOutdated({ station: totalStation, loadedAt: undefined }, NOW)).toBe(false);
  });
});
