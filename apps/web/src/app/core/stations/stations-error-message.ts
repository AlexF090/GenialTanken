import { HttpErrorResponse } from '@angular/common/http';
import { HTTP_STATUS } from '../http/http-status';
import {
  noResponseMessage,
  TOO_MANY_REQUESTS_MESSAGE,
  TRY_AGAIN_LATER,
} from '../http/request-failure-messages';
import { UnexpectedResponseError } from '../http/unexpected-response-error';
import { StationSourceUnavailableError } from './station-source-unavailable-error';

export const STATION_NOT_FOUND_MESSAGE =
  'Die Tankstelle konnte in unserer Datenbank nicht gefunden werden.';

const PRICES_UNAVAILABLE_MESSAGE = `Die Preisdaten sind gerade nicht erreichbar. ${TRY_AGAIN_LATER}`;
const STATIONS_NOT_LOADED_MESSAGE = `Die Tankstellen konnten nicht geladen werden. ${TRY_AGAIN_LATER}`;

interface ConnectionState {
  isOnline: boolean;
}

/** Single place that turns failures of the stations API into user-facing German messages. */
export const describeStationsError = (error: unknown, { isOnline }: ConnectionState): string => {
  if (error instanceof UnexpectedResponseError) {
    return `Der Server hat unerwartete Daten geliefert. ${TRY_AGAIN_LATER}`;
  }
  if (error instanceof StationSourceUnavailableError) {
    return PRICES_UNAVAILABLE_MESSAGE;
  }
  if (!(error instanceof HttpErrorResponse)) {
    return STATIONS_NOT_LOADED_MESSAGE;
  }
  switch (error.status) {
    case HTTP_STATUS.networkFailure:
      return noResponseMessage(isOnline);
    case HTTP_STATUS.notFound:
      return STATION_NOT_FOUND_MESSAGE;
    case HTTP_STATUS.tooManyRequests:
      return TOO_MANY_REQUESTS_MESSAGE;
    case HTTP_STATUS.badGateway:
    case HTTP_STATUS.serviceUnavailable:
    case HTTP_STATUS.gatewayTimeout:
      return PRICES_UNAVAILABLE_MESSAGE;
    default:
      return STATIONS_NOT_LOADED_MESSAGE;
  }
};
