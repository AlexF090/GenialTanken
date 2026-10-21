import { HttpErrorResponse } from '@angular/common/http';

export const PLACES_UNAVAILABLE_MESSAGE = 'Die Ortssuche ist gerade nicht erreichbar.';

const HTTP_STATUS_TOO_MANY_REQUESTS = 429;

/**
 * Single place that turns failures of the place search into user-facing German messages. The
 * search stays usable without it (the start center works), so most failures share one message.
 */
export const describePlacesError = (error: unknown): string =>
  error instanceof HttpErrorResponse && error.status === HTTP_STATUS_TOO_MANY_REQUESTS
    ? 'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.'
    : PLACES_UNAVAILABLE_MESSAGE;
