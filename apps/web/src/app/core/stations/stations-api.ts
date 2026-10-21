import { HttpClient, httpResource } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST,
  stationLookupSchema,
  stationSchema,
  stationsSchema,
} from '@genialtanken/contracts';
import type { FuelType, Station, StationLookup } from '@genialtanken/contracts';
import { firstValueFrom } from 'rxjs';
import type { Coordinates } from '../geolocation/coordinates';
import { parseResponse } from '../http/parse-response';
import { StationSourceUnavailableError } from './station-source-unavailable-error';

export interface StationsSearch extends Coordinates {
  radiusInKilometers: number;
  fuelType: FuelType;
}

export interface StationLoadFailure {
  stationIdentifier: string;
  error: unknown;
}

export interface StationsByIdentifiers {
  stations: Station[];
  /**
   * Identifiers the providers do not know right now, e.g. a German station while the optional
   * German provider is disabled. They may come back, so callers must not treat them as deleted.
   */
  unavailableStationIdentifiers: string[];
  /**
   * Stations that could not be loaded: their price source was unreachable
   * ({@link StationSourceUnavailableError}), or the whole request of their chunk failed (network,
   * 4xx, 5xx, contract violation).
   */
  failures: StationLoadFailure[];
}

/** Same origin: dev proxy locally, a Cloudflare Pages Function in production. */
const STATIONS_URL = '/api/stations';
const STATIONS_BY_IDENTIFIERS_URL = `${STATIONS_URL}/by-identifiers`;

const parseStations = (body: unknown): Station[] =>
  parseResponse(stationsSchema, body, 'GET /api/stations');

const parseStation = (body: unknown): Station =>
  parseResponse(stationSchema, body, 'GET /api/stations/:id');

const toChunks = (identifiers: readonly string[]): string[][] => {
  const chunks: string[][] = [];
  for (
    let start = 0;
    start < identifiers.length;
    start += MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST
  ) {
    chunks.push(identifiers.slice(start, start + MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST));
  }
  return chunks;
};

/**
 * Client of the GenialTanken BFF. Every response is validated against the shared contract;
 * a mismatch surfaces as {@link UnexpectedResponseError}.
 * The resource factories must be called in an injection context (e.g. a field initializer).
 */
@Injectable({ providedIn: 'root' })
export class StationsApi {
  private readonly httpClient = inject(HttpClient);

  /** Stations around a position; idle while `search` returns `undefined`. */
  stationsAround(search: () => StationsSearch | undefined): HttpResourceRef<Station[] | undefined> {
    return httpResource(
      () => {
        const currentSearch = search();
        if (currentSearch === undefined) {
          return undefined;
        }
        return {
          url: STATIONS_URL,
          params: {
            latitude: currentSearch.latitude,
            longitude: currentSearch.longitude,
            radiusInKilometers: currentSearch.radiusInKilometers,
            fuel: currentSearch.fuelType,
          },
        };
      },
      { parse: parseStations }
    );
  }

  /** A single station; idle while `stationIdentifier` returns `undefined`. */
  stationByIdentifier(
    stationIdentifier: () => string | undefined
  ): HttpResourceRef<Station | undefined> {
    return httpResource(
      () => {
        const currentStationIdentifier = stationIdentifier();
        return currentStationIdentifier === undefined
          ? undefined
          : `${STATIONS_URL}/${encodeURIComponent(currentStationIdentifier)}`;
      },
      { parse: parseStation }
    );
  }

  /**
   * Loads several stations, at most {@link MAXIMUM_STATION_IDENTIFIERS_PER_REQUEST} per request,
   * with the chunks in parallel. Never rejects: every identifier ends up either as a station, as
   * unavailable or as a failure, so one broken request does not hide the other stations. Stations
   * keep the order of `stationIdentifiers`.
   */
  async loadStationsByIdentifiers(
    stationIdentifiers: readonly string[]
  ): Promise<StationsByIdentifiers> {
    const uniqueStationIdentifiers = [...new Set(stationIdentifiers)];
    const chunks = toChunks(uniqueStationIdentifiers);
    const results = await Promise.allSettled(chunks.map(chunk => this.lookUpStations(chunk)));
    const stationsByIdentifiers: StationsByIdentifiers = {
      stations: [],
      unavailableStationIdentifiers: [],
      failures: [],
    };
    // `allSettled` keeps the order of its input, so each result belongs to the chunk at its index.
    chunks.forEach((chunk, index) => {
      const result = results[index];
      if (result === undefined) {
        return;
      }
      if (result.status === 'rejected') {
        const error: unknown = result.reason;
        stationsByIdentifiers.failures.push(
          ...chunk.map(stationIdentifier => ({ stationIdentifier, error }))
        );
        return;
      }
      const { stations, unavailableIdentifiers, failedIdentifiers } = result.value;
      stationsByIdentifiers.stations.push(...stations);
      stationsByIdentifiers.unavailableStationIdentifiers.push(...unavailableIdentifiers);
      stationsByIdentifiers.failures.push(
        ...failedIdentifiers.map(stationIdentifier => ({
          stationIdentifier,
          error: new StationSourceUnavailableError(stationIdentifier),
        }))
      );
    });
    const positionOf = (station: Station): number => uniqueStationIdentifiers.indexOf(station.id);
    stationsByIdentifiers.stations.sort((first, second) => positionOf(first) - positionOf(second));
    return stationsByIdentifiers;
  }

  private async lookUpStations(stationIdentifiers: readonly string[]): Promise<StationLookup> {
    const body = await firstValueFrom(
      this.httpClient.get<unknown>(STATIONS_BY_IDENTIFIERS_URL, {
        params: { identifiers: stationIdentifiers.join(',') },
      })
    );
    return parseResponse(stationLookupSchema, body, `GET ${STATIONS_BY_IDENTIFIERS_URL}`);
  }
}
