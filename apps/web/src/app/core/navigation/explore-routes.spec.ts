import { DefaultUrlSerializer } from '@angular/router';
import { FAVORITES_ROUTE_PATH, isRouteOpen } from './explore-routes';

const parse = (url: string) => new DefaultUrlSerializer().parse(url);

describe('isRouteOpen', () => {
  it('matches the path exactly, also with a query or fragment', () => {
    expect(isRouteOpen(parse('/favorites'), FAVORITES_ROUTE_PATH)).toBe(true);
    expect(isRouteOpen(parse('/favorites?source=shortcut#top'), FAVORITES_ROUTE_PATH)).toBe(true);
  });

  it.each(['/', '/settings', '/favorites/fr-75001001', '/stations/favorites'])(
    'does not match %s',
    url => {
      expect(isRouteOpen(parse(url), FAVORITES_ROUTE_PATH)).toBe(false);
    }
  );
});
