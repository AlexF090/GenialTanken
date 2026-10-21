import { HttpErrorResponse } from '@angular/common/http';
import { UnexpectedResponseError } from '../http/unexpected-response-error';
import { describePlacesError } from './places-error-message';

describe('describePlacesError', () => {
  it('reports the place search as unavailable', () => {
    const unavailable = 'Die Ortssuche ist gerade nicht erreichbar.';

    expect(describePlacesError(new HttpErrorResponse({ status: 502 }))).toBe(unavailable);
    expect(describePlacesError(new HttpErrorResponse({ status: 0 }))).toBe(unavailable);
    expect(describePlacesError(new UnexpectedResponseError('GET /api/places', 'invalid'))).toBe(
      unavailable
    );
  });

  it('asks to wait when there were too many requests', () => {
    expect(describePlacesError(new HttpErrorResponse({ status: 429 }))).toBe(
      'Zu viele Anfragen. Bitte warte einen Moment und versuche es erneut.'
    );
  });
});
