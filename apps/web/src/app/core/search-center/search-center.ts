import type { Coordinates } from '../geolocation/coordinates';

/** Where the current search center came from. */
export type SearchCenterSource = 'default' | 'place' | 'own-position';

/** Point the nearby stations are searched around, with a label to show to the user. */
export interface SearchCenter extends Coordinates {
  label: string;
  source: SearchCenterSource;
}

/** Start center of every visit; deliberately never persisted and never the user's position. */
export const DEFAULT_SEARCH_CENTER: SearchCenter = {
  latitude: 48.8584,
  longitude: 2.2945,
  label: 'Eiffelturm, Paris',
  source: 'default',
};

export const isSameSearchCenter = (first: SearchCenter, second: SearchCenter): boolean =>
  first.latitude === second.latitude &&
  first.longitude === second.longitude &&
  first.source === second.source &&
  first.label === second.label;
