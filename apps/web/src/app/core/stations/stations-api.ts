import { HttpClient, httpResource } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { stationSchema, stationsSchema } from '@genialtanken/contracts';
import type { FuelType, Station } from '@genialtanken/contracts';
import { firstValueFrom } from 'rxjs';
import type { Coordinates } from '../geolocation/coordinates';
import { isNotFoundError } from './stations-error-message';
import { UnexpectedResponseError } from './unexpected-response-error';

export interface StationsSearch extends Coordinates {
  radiusInKilometers: number;
  fuelType: FuelType;
}

export interface StationLoadFailure {
  stationId: string;
  error: unknown;
}

export interface StationsByIds {
  stations: Station[];
  /**
   * Ids the API answers with 404, e.g. a German station while the optional German provider is
   * disabled. They may come back, so callers must not treat them as deleted.
   */
  unavailableStationIds: string[];
  /** Stations whose request failed for any other reason (network, 5xx, contract violation). */
  failures: StationLoadFailure[];
}

/** Same origin: dev proxy locally, a Cloudflare Pages Function in production. */
const STATIONS_URL = '/api/stations';

const parseStations = (body: unknown): Station[] => {
  const result = stationsSchema.safeParse(body);
  if (!result.success) {
    throw new UnexpectedResponseError('GET /api/stations', result.error.message);
  }
  return result.data;
};

const parseStation = (body: unknown): Station => {
  const result = stationSchema.safeParse(body);
  if (!result.success) {
    throw new UnexpectedResponseError('GET /api/stations/:id', result.error.message);
  }
  return result.data;
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

  /** A single station; idle while `stationId` returns `undefined`. */
  stationById(stationId: () => string | undefined): HttpResourceRef<Station | undefined> {
    return httpResource(
      () => {
        const currentStationId = stationId();
        return currentStationId === undefined
          ? undefined
          : `${STATIONS_URL}/${encodeURIComponent(currentStationId)}`;
      },
      { parse: parseStation }
    );
  }

  /**
   * Loads several stations in parallel. Never rejects: every id ends up either as a station, as
   * unavailable (404) or as a failure, so one broken request does not hide the other stations.
   */
  async loadStationsByIds(stationIds: readonly string[]): Promise<StationsByIds> {
    const results = await Promise.allSettled(
      stationIds.map(stationId => this.loadStation(stationId))
    );
    const stationsByIds: StationsByIds = { stations: [], unavailableStationIds: [], failures: [] };
    // `allSettled` keeps the order of its input, so each result belongs to the id at its index.
    stationIds.forEach((stationId, index) => {
      const result = results[index];
      if (result === undefined) {
        return;
      }
      if (result.status === 'fulfilled') {
        stationsByIds.stations.push(result.value);
        return;
      }
      if (isNotFoundError(result.reason)) {
        stationsByIds.unavailableStationIds.push(stationId);
        return;
      }
      stationsByIds.failures.push({ stationId, error: result.reason });
    });
    return stationsByIds;
  }

  private async loadStation(stationId: string): Promise<Station> {
    const body = await firstValueFrom(
      this.httpClient.get<unknown>(`${STATIONS_URL}/${encodeURIComponent(stationId)}`)
    );
    return parseStation(body);
  }
}
