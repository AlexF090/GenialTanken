import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { z } from 'zod';
import { MOCK_UPSTREAM_PORT as PORT, UNEXPECTED_REQUESTS_PATH } from './mock-upstream-endpoints.ts';

/**
 * Stand-in for the French government fuel price API (data.economie.gouv.fr, Opendatasoft
 * Explore API v2.1) so the browser suite runs without network access. Serves real records
 * captured around Paris from `data/france-stations.json`, honouring the fuel filter
 * (`<fuel>_prix is not null`), the search radius (`within_distance`) and lookups by `id`.
 *
 * Requests the mock does not know are answered with 500 and recorded; the test fixture reads
 * them from `UNEXPECTED_REQUESTS_PATH` after every test and fails the test.
 */

const franceRecordSchema = z.looseObject({
  id: z.number(),
  geom: z.object({ lat: z.number(), lon: z.number() }),
});

const franceResponseSchema = z.object({
  total_count: z.number(),
  results: z.array(franceRecordSchema),
});

type FranceRecord = z.infer<typeof franceRecordSchema>;

type FranceResponse = z.infer<typeof franceResponseSchema>;

interface Point {
  latitude: number;
  longitude: number;
}

interface DistanceFilter {
  center: Point;
  radiusInMeters: number;
}

const DATASET_PATH =
  '/api/explore/v2.1/catalog/datasets/prix-des-carburants-en-france-flux-instantane-v2/records';

const fixture = franceResponseSchema.parse(
  JSON.parse(readFileSync(new URL('./data/france-stations.json', import.meta.url), 'utf8'))
);

const unexpectedRequests: string[] = [];

const sendJson = (response: ServerResponse, statusCode: number, body: unknown) => {
  response.writeHead(statusCode, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
};

const EARTH_RADIUS_IN_METERS = 6_371_008.8;
const METERS_PER_KILOMETER = 1000;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance (haversine); precise enough to filter and order the fixture. */
const distanceInMeters = (first: Point, second: Point): number => {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(toRadians(first.latitude)) *
      Math.cos(toRadians(second.latitude)) *
      Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_IN_METERS * Math.asin(Math.sqrt(haversine));
};

const recordPoint = (record: FranceRecord): Point => ({
  latitude: record.geom.lat,
  longitude: record.geom.lon,
});

/** `within_distance(geom, geom'POINT(<longitude> <latitude>)', <radius>km)` */
const parseDistanceFilter = (whereClause: string): DistanceFilter | undefined => {
  const match = /within_distance\(geom,\s*geom'POINT\(([-\d.]+) ([-\d.]+)\)',\s*([\d.]+)km\)/.exec(
    whereClause
  );
  if (!match) {
    return undefined;
  }
  return {
    center: { longitude: Number(match[1]), latitude: Number(match[2]) },
    radiusInMeters: Number(match[3]) * METERS_PER_KILOMETER,
  };
};

const toResponse = (records: FranceRecord[]): FranceResponse => ({
  total_count: records.length,
  results: records,
});

const answerRecordsQuery = (whereClause: string): FranceResponse => {
  const identifierMatch = /\bid\s*=\s*(\d+)/.exec(whereClause);
  if (identifierMatch) {
    const identifier = Number(identifierMatch[1]);
    return toResponse(fixture.results.filter(record => record.id === identifier));
  }

  const fuelFields = [...whereClause.matchAll(/(\w+_prix) is not null/g)].map(match => match[1]);
  const distanceFilter = parseDistanceFilter(whereClause);
  const distanceFromCenter = (record: FranceRecord): number =>
    distanceFilter === undefined ? 0 : distanceInMeters(distanceFilter.center, recordPoint(record));
  const matchingRecords = fixture.results.filter(
    record =>
      fuelFields.every(field => field !== undefined && record[field] !== null) &&
      (distanceFilter === undefined || distanceFromCenter(record) <= distanceFilter.radiusInMeters)
  );
  return toResponse(
    [...matchingRecords].sort(
      (first, second) => distanceFromCenter(first) - distanceFromCenter(second)
    )
  );
};

const handleRequest = (request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url ?? '/', `http://localhost:${String(PORT)}`);
  if (request.method === 'GET' && url.pathname === UNEXPECTED_REQUESTS_PATH) {
    sendJson(response, 200, unexpectedRequests.splice(0));
    return;
  }
  if (request.method !== 'GET' || url.pathname !== DATASET_PATH) {
    const description = `${request.method ?? ''} ${url.href}`;
    console.error(`Mock upstream: unexpected request ${description}`);
    unexpectedRequests.push(description);
    sendJson(response, 500, { error_code: 'NotMocked', message: `Not mocked: ${description}` });
    return;
  }
  sendJson(response, 200, answerRecordsQuery(url.searchParams.get('where') ?? ''));
};

createServer(handleRequest).listen(PORT, () => {
  console.log(`Mock upstream listening on http://localhost:${String(PORT)}`);
});
