import { HttpClient, httpResource } from '@angular/common/http';
import type { HttpResourceRef } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { stationSchema, stationsSchema } from '@genialtanken/contracts';
import type { FuelType, Station } from '@genialtanken/contracts';
import { firstValueFrom } from 'rxjs';
import { isNotFoundError } from './stations-error-message';
import { UnexpectedResponseError } from './unexpected-response-error';

export interface StationsSearch {
  latitude: number;
  longitude: number;
  radiusInKilometers: number;
  fuelType: FuelType;
}

export interface StationsByIds {
  stations: Station[];
  /** Ids the API does not know (anymore), e.g. stale favorites. */
  unknownStationIds: string[];
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

  /** Loads several stations in parallel; unknown ids are reported instead of failing. */
  async loadStationsByIds(stationIds: readonly string[]): Promise<StationsByIds> {
    const results = await Promise.all(
      stationIds.map(async stationId => {
        try {
          const body = await firstValueFrom(
            this.httpClient.get<unknown>(`${STATIONS_URL}/${encodeURIComponent(stationId)}`)
          );
          return { stationId, station: parseStation(body) };
        } catch (error) {
          if (isNotFoundError(error)) {
            return { stationId, station: undefined };
          }
          throw error;
        }
      })
    );
    return {
      stations: results.flatMap(result => (result.station === undefined ? [] : [result.station])),
      unknownStationIds: results
        .filter(result => result.station === undefined)
        .map(result => result.stationId),
    };
  }
}
