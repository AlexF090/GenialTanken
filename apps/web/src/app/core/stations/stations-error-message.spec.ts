import { HttpErrorResponse } from '@angular/common/http';
import { UnexpectedResponseError } from '../http/unexpected-response-error';
import { StationSourceUnavailableError } from './station-source-unavailable-error';
import { describeStationsError, STATION_NOT_FOUND_MESSAGE } from './stations-error-message';

const DEFAULT_MESSAGE =
  'Die Tankstellen konnten nicht geladen werden. Bitte versuche es später erneut.';
const PRICES_UNAVAILABLE_MESSAGE =
  'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.';

describe('describeStationsError', () => {
  it.each<{ description: string; error: unknown; message: string }>([
    {
      description: 'a contract violation',
      error: new UnexpectedResponseError('GET /api/stations', 'invalid'),
      message: 'Der Server hat unerwartete Daten geliefert. Bitte versuche es später erneut.',
    },
    {
      description: 'an unreachable price source of a station',
      error: new StationSourceUnavailableError('fr-75001001'),
      message: PRICES_UNAVAILABLE_MESSAGE,
    },
    {
      description: 'an error that is no HTTP error',
      error: new TypeError('Failed to fetch'),
      message: DEFAULT_MESSAGE,
    },
    {
      description: 'status 0 (no connection)',
      error: new HttpErrorResponse({ status: 0 }),
      message: 'Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung.',
    },
    {
      description: 'status 404',
      error: new HttpErrorResponse({ status: 404 }),
      message: STATION_NOT_FOUND_MESSAGE,
    },
    {
      description: 'status 429',
      error: new HttpErrorResponse({ status: 429 }),
      message: 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.',
    },
    {
      description: 'status 502',
      error: new HttpErrorResponse({ status: 502 }),
      message: PRICES_UNAVAILABLE_MESSAGE,
    },
    {
      description: 'status 503',
      error: new HttpErrorResponse({ status: 503 }),
      message: PRICES_UNAVAILABLE_MESSAGE,
    },
    {
      description: 'status 504',
      error: new HttpErrorResponse({ status: 504 }),
      message: PRICES_UNAVAILABLE_MESSAGE,
    },
    {
      description: 'another status',
      error: new HttpErrorResponse({ status: 500 }),
      message: DEFAULT_MESSAGE,
    },
  ])('describes $description', ({ error, message }) => {
    expect(describeStationsError(error)).toBe(message);
  });
});
