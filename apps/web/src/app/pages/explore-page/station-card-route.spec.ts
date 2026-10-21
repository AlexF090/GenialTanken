import { DefaultUrlSerializer } from '@angular/router';
import { stationIdentifierIn } from './station-card-route';

const parse = (url: string) => new DefaultUrlSerializer().parse(url);

describe('stationIdentifierIn', () => {
  it('finds the station of a card route', () => {
    expect(stationIdentifierIn(parse('/stations/fr-75001001'))).toBe('fr-75001001');
  });

  it('decodes the station identifier', () => {
    expect(stationIdentifierIn(parse('/stations/de-a%2Fb'))).toBe('de-a/b');
  });

  it.each(['/', '/stations', '/favorites', '/stations/fr-75001001/extra', '/places/fr-75001001'])(
    'finds none in %s',
    url => {
      expect(stationIdentifierIn(parse(url))).toBeUndefined();
    }
  );

  it('finds none without a URL', () => {
    expect(stationIdentifierIn(undefined)).toBeUndefined();
  });
});
