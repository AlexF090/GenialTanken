import type { Coordinates } from '@genialtanken/contracts';

export interface NavigationDestination extends Coordinates {
  name: string;
}

export interface NavigationApp {
  identifier: string;
  label: string;
  /** Universal link: opens the app where it is installed, its website otherwise. */
  routeUrl: (destination: NavigationDestination) => string;
}

const coordinatesOf = ({ latitude, longitude }: Coordinates): string =>
  `${String(latitude)},${String(longitude)}`;

/**
 * Apps a route can be started in. A web app cannot ask the device which ones are installed, so
 * the common ones are offered and their links fall back to the website.
 */
export const NAVIGATION_APPS: readonly NavigationApp[] = [
  {
    identifier: 'apple-maps',
    label: 'Apple Karten',
    routeUrl: destination =>
      `https://maps.apple.com/?${new URLSearchParams({
        daddr: coordinatesOf(destination),
        q: destination.name,
        dirflg: 'd',
      }).toString()}`,
  },
  {
    identifier: 'google-maps',
    label: 'Google Maps',
    routeUrl: destination =>
      `https://www.google.com/maps/dir/?${new URLSearchParams({
        api: '1',
        destination: coordinatesOf(destination),
        travelmode: 'driving',
      }).toString()}`,
  },
  {
    identifier: 'waze',
    label: 'Waze',
    routeUrl: destination =>
      `https://waze.com/ul?${new URLSearchParams({
        ll: coordinatesOf(destination),
        navigate: 'yes',
      }).toString()}`,
  },
];
