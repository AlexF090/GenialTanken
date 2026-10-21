import { placesSchema } from '@genialtanken/contracts';
import { bastillePlace } from '../../../testing/place-fixtures';
import { parseResponse } from './parse-response';
import { UnexpectedResponseError } from './unexpected-response-error';

describe('parseResponse', () => {
  it('returns the validated body', () => {
    expect(parseResponse(placesSchema, [bastillePlace], 'GET /api/places')).toEqual([
      bastillePlace,
    ]);
  });

  it('throws an UnexpectedResponseError naming the endpoint on a contract violation', () => {
    const parseInvalidBody = (): unknown =>
      parseResponse(placesSchema, [{ id: 1 }], 'GET /api/places');

    expect(parseInvalidBody).toThrow(UnexpectedResponseError);
    expect(parseInvalidBody).toThrow(
      /^Response of GET \/api\/places does not match the contract: /
    );
  });
});
