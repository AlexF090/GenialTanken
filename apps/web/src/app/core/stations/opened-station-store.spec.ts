import { TestBed } from '@angular/core/testing';
import { essoStation, totalStation } from '../../../testing/station-fixtures';
import { OpenedStationStore } from './opened-station-store';

describe('OpenedStationStore', () => {
  it('holds the opened station with the time its prices arrived until it closes', () => {
    const store = TestBed.inject(OpenedStationStore);
    const loadedAt = new Date('2026-10-23T12:00:00');

    expect(store.station()).toBeUndefined();
    expect(store.loadedAt()).toBeUndefined();

    store.open(totalStation, loadedAt);
    expect(store.station()).toBe(totalStation);
    expect(store.loadedAt()).toBe(loadedAt);

    store.open(essoStation, undefined);
    expect(store.station()).toBe(essoStation);
    expect(store.loadedAt()).toBeUndefined();

    store.close();
    expect(store.station()).toBeUndefined();
    expect(store.loadedAt()).toBeUndefined();
  });
});
