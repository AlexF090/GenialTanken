/**
 * Origins the map loads its tiles from. Plain constants without imports on purpose: the hosting
 * build (`hosting/`) reads them as well, to allow exactly these origins in the Content Security
 * Policy.
 */
export const OPEN_STREET_MAP_TILE_ORIGIN = 'https://tile.openstreetmap.org';
export const MAPBOX_TILE_ORIGIN = 'https://api.mapbox.com';

export const MAP_TILE_ORIGINS: readonly string[] = [
  OPEN_STREET_MAP_TILE_ORIGIN,
  MAPBOX_TILE_ORIGIN,
];
