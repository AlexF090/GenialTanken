import { NAVIGATION_APPS } from './navigation-apps';

const destination = { latitude: 48.8532, longitude: 2.3692, name: 'Total & Co' };

const routeUrlOf = (identifier: string): string => {
  const app = NAVIGATION_APPS.find(candidate => candidate.identifier === identifier);
  if (app === undefined) {
    throw new Error(`No navigation app ${identifier}`);
  }
  return app.routeUrl(destination);
};

describe('NAVIGATION_APPS', () => {
  it('offers Apple Karten, Google Maps and Waze', () => {
    expect(NAVIGATION_APPS.map(app => app.label)).toEqual(['Apple Karten', 'Google Maps', 'Waze']);
  });

  it('starts a driving route in Apple Karten with the encoded station name', () => {
    expect(routeUrlOf('apple-maps')).toBe(
      'https://maps.apple.com/?daddr=48.8532%2C2.3692&q=Total+%26+Co&dirflg=d'
    );
  });

  it('starts a driving route in Google Maps', () => {
    expect(routeUrlOf('google-maps')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=48.8532%2C2.3692&travelmode=driving'
    );
  });

  it('starts navigation in Waze', () => {
    expect(routeUrlOf('waze')).toBe('https://waze.com/ul?ll=48.8532%2C2.3692&navigate=yes');
  });
});
