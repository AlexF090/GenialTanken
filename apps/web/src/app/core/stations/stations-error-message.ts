import { HttpErrorResponse } from '@angular/common/http';
import { UnexpectedResponseError } from '../http/unexpected-response-error';

export const STATION_NOT_FOUND_MESSAGE =
  'Die Tankstelle konnte in unserer Datenbank nicht gefunden werden.';

const HTTP_STATUS_NOT_FOUND = 404;
const HTTP_STATUS_TOO_MANY_REQUESTS = 429;
const HTTP_STATUS_BAD_GATEWAY = 502;
const HTTP_STATUS_SERVICE_UNAVAILABLE = 503;
const HTTP_STATUS_GATEWAY_TIMEOUT = 504;

export const isNotFoundError = (error: unknown): boolean =>
  error instanceof HttpErrorResponse && error.status === HTTP_STATUS_NOT_FOUND;

/** Single place that turns failures of the stations API into user-facing German messages. */
export const describeStationsError = (error: unknown): string => {
  if (error instanceof UnexpectedResponseError) {
    return 'Der Server hat unerwartete Daten geliefert. Bitte versuche es später erneut.';
  }
  if (!(error instanceof HttpErrorResponse)) {
    return 'Die Tankstellen konnten nicht geladen werden. Bitte versuche es später erneut.';
  }
  switch (error.status) {
    case 0:
      return 'Der Server ist nicht erreichbar. Bitte prüfe deine Internetverbindung.';
    case HTTP_STATUS_NOT_FOUND:
      return STATION_NOT_FOUND_MESSAGE;
    case HTTP_STATUS_TOO_MANY_REQUESTS:
      return 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.';
    case HTTP_STATUS_BAD_GATEWAY:
    case HTTP_STATUS_SERVICE_UNAVAILABLE:
    case HTTP_STATUS_GATEWAY_TIMEOUT:
      return 'Die Preisdaten sind gerade nicht erreichbar. Bitte versuche es später erneut.';
    default:
      return 'Die Tankstellen konnten nicht geladen werden. Bitte versuche es später erneut.';
  }
};
