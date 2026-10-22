import { emptyOpeningTimes } from '@genialtanken/contracts';
import type { CountryCode, Station, StationsQuery } from '@genialtanken/contracts';
import { BadGatewayException, Logger } from '@nestjs/common';
import type { MockInstance } from 'vitest';
import { ERROR_MESSAGES } from '../common/error-messages.js';
import type { FuelPriceProvider } from '../fuel-price-providers/fuel-price-provider.js';
import { UpstreamError } from '../upstream/upstream-error.js';
import { StationsService } from './stations.service.js';

const PARIS: StationsQuery = {
  latitude: 48.8566,
  longitude: 2.3522,
  radiusInKilometers: 5,
  fuel: 'e10',
};

const stationOf = (
  country: CountryCode,
  localIdentifier: string,
  position = { latitude: 48.85, longitude: 2.36 }
): Station => ({
  id: `${country.toLowerCase()}-${localIdentifier}`,
  country,
  name: null,
  brand: null,
  address: {
    street: 'Rue de Test',
    houseNumber: null,
    postalCode: '75000',
    city: 'Paris',
    ...position,
  },
  pricesInEuro: { e5: null, e10: 1.9, superPlus: null, diesel: null, e85: null, lpg: null },
  isOpen: null,
  openingTimes: emptyOpeningTimes(),
  distanceInMeters: null,
});

interface FakeProviderBehavior {
  findStationsAround?: (query: StationsQuery) => Promise<Station[]>;
  findStationByIdentifier?: (localIdentifier: string) => Promise<Station | null>;
}

const fakeProvider = (
  country: CountryCode,
  behavior: FakeProviderBehavior = {}
): FuelPriceProvider & { readonly requestedIdentifiers: string[] } => {
  const requestedIdentifiers: string[] = [];
  return {
    country,
    requestedIdentifiers,
    findStationsAround: behavior.findStationsAround ?? (() => Promise.resolve([])),
    findStationByIdentifier: localIdentifier => {
      requestedIdentifiers.push(localIdentifier);
      return behavior.findStationByIdentifier?.(localIdentifier) ?? Promise.resolve(null);
    },
  };
};

const knowing = (country: CountryCode, ...localIdentifiers: string[]) =>
  fakeProvider(country, {
    findStationByIdentifier: localIdentifier =>
      Promise.resolve(
        localIdentifiers.includes(localIdentifier) ? stationOf(country, localIdentifier) : null
      ),
  });

const failingWith = (reason: Error) => () => Promise.reject(reason);

const delayed = <Value>(value: Value, delayInMilliseconds: number): Promise<Value> =>
  new Promise(resolve => {
    setTimeout(() => {
      resolve(value);
    }, delayInMilliseconds);
  });

let loggedWarning: MockInstance<Logger['warn']>;
let loggedError: MockInstance<Logger['error']>;

beforeEach(() => {
  loggedWarning = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  loggedError = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('StationsService.findStationsAround', () => {
  it('returns the stations of the providers that answered when another one fails', async () => {
    const service = new StationsService([
      fakeProvider('FR', { findStationsAround: () => Promise.resolve([stationOf('FR', '1')]) }),
      fakeProvider('FR', {
        findStationsAround: failingWith(new UpstreamError('the second source is down')),
      }),
    ]);

    const stations = await service.findStationsAround(PARIS);

    expect(stations.map(station => station.id)).toEqual(['fr-1']);
  });

  it('returns partial results when a provider fails with an unexpected error', async () => {
    const service = new StationsService([
      fakeProvider('FR', { findStationsAround: failingWith(new TypeError('a bug')) }),
      fakeProvider('FR', { findStationsAround: () => Promise.resolve([stationOf('FR', 'a')]) }),
    ]);

    const stations = await service.findStationsAround(PARIS);

    expect(stations.map(station => station.id)).toEqual(['fr-a']);
    expect(loggedError).toHaveBeenCalled();
  });

  it('responds with 502 when every provider fails', async () => {
    const service = new StationsService([
      fakeProvider('FR', { findStationsAround: failingWith(new UpstreamError('timeout')) }),
      fakeProvider('FR', { findStationsAround: failingWith(new TypeError('a bug')) }),
    ]);

    const search = service.findStationsAround(PARIS);

    await expect(search).rejects.toThrow(BadGatewayException);
    await expect(search).rejects.toThrow(ERROR_MESSAGES.upstreamUnavailable);
  });
});

describe('StationsService.findStationsByIdentifiers', () => {
  it('asks the provider of the country prefix for its local identifiers only', async () => {
    const france = knowing('FR', '1', '2');
    const service = new StationsService([france]);

    const lookup = await service.findStationsByIdentifiers(['fr-1', 'it-a', 'fr-2']);

    expect(france.requestedIdentifiers).toEqual(['1', '2']);
    expect(lookup).toEqual({
      stations: [stationOf('FR', '1'), stationOf('FR', '2')],
      unavailableIdentifiers: ['it-a'],
      failedIdentifiers: [],
    });
  });

  it('lists unknown stations and countries without a provider as unavailable', async () => {
    const service = new StationsService([knowing('FR', '1')]);

    const lookup = await service.findStationsByIdentifiers(['fr-404', 'fr-1', 'de-a', 'it-1']);

    expect(lookup).toEqual({
      stations: [stationOf('FR', '1')],
      unavailableIdentifiers: ['fr-404', 'de-a', 'it-1'],
      failedIdentifiers: [],
    });
  });

  it('lists the identifiers of failing lookups as failed and keeps the others', async () => {
    const service = new StationsService([
      fakeProvider('FR', {
        findStationByIdentifier: localIdentifier =>
          localIdentifier === '1'
            ? Promise.resolve(stationOf('FR', '1'))
            : Promise.reject(new UpstreamError('the station page is down')),
      }),
    ]);

    const lookup = await service.findStationsByIdentifiers(['fr-a', 'fr-1', 'fr-b']);

    expect(lookup).toEqual({
      stations: [stationOf('FR', '1')],
      unavailableIdentifiers: [],
      failedIdentifiers: ['fr-a', 'fr-b'],
    });
    expect(loggedWarning).toHaveBeenCalledWith(
      'Fuel price provider FR failed: the station page is down'
    );
  });

  it('keeps the requested order even when later lookups finish first', async () => {
    const service = new StationsService([
      fakeProvider('FR', {
        findStationByIdentifier: localIdentifier =>
          delayed(stationOf('FR', localIdentifier), localIdentifier === 'slow' ? 30 : 0),
      }),
    ]);

    const lookup = await service.findStationsByIdentifiers(['fr-slow', 'fr-fast']);

    expect(lookup.stations.map(station => station.id)).toEqual(['fr-slow', 'fr-fast']);
  });

  it('looks up a repeated identifier once and lists it once', async () => {
    const france = knowing('FR', '1');
    const service = new StationsService([france]);

    const lookup = await service.findStationsByIdentifiers(['fr-1', 'fr-404', 'fr-1', 'fr-404']);

    expect(france.requestedIdentifiers).toEqual(['1', '404']);
    expect(lookup).toEqual({
      stations: [stationOf('FR', '1')],
      unavailableIdentifiers: ['fr-404'],
      failedIdentifiers: [],
    });
  });

  it('responds with 502 when every lookup fails', async () => {
    const service = new StationsService([
      fakeProvider('FR', { findStationByIdentifier: failingWith(new TypeError('a bug')) }),
    ]);

    await expect(service.findStationsByIdentifiers(['fr-1', 'fr-2'])).rejects.toThrow(
      BadGatewayException
    );
  });

  it('answers instead of failing when only some lookups fail', async () => {
    const service = new StationsService([
      fakeProvider('FR', { findStationByIdentifier: failingWith(new UpstreamError('timeout')) }),
    ]);

    const lookup = await service.findStationsByIdentifiers(['fr-1', 'it-a']);

    expect(lookup).toEqual({
      stations: [],
      unavailableIdentifiers: ['it-a'],
      failedIdentifiers: ['fr-1'],
    });
  });
});
