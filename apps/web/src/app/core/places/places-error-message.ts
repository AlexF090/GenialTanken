import { HttpErrorResponse } from '@angular/common/http';
import { HTTP_STATUS } from '../http/http-status';
import { TOO_MANY_REQUESTS_MESSAGE } from '../http/request-failure-messages';

export const PLACES_UNAVAILABLE_MESSAGE = 'Die Ortssuche ist gerade nicht erreichbar.';

/**
 * Single place that turns failures of the place search into user-facing German messages. The
 * search stays usable without it (the start center works), so most failures share one message.
 */
export const describePlacesError = (error: unknown): string =>
  error instanceof HttpErrorResponse && error.status === HTTP_STATUS.tooManyRequests
    ? TOO_MANY_REQUESTS_MESSAGE
    : PLACES_UNAVAILABLE_MESSAGE;
