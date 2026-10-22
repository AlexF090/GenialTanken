import type { ResolvedColorScheme } from '../../core/theme/color-scheme-controller';
import { L } from './leaflet';

const MAPBOX_STYLES: Readonly<Record<ResolvedColorScheme, string>> = {
  light: 'alexf090/cl2uhl8gx008p14qop192uczn',
  dark: 'mapbox/dark-v11',
};
const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OPEN_STREET_MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OPEN_STREET_MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';
export const MAXIMUM_ZOOM = 19;

const mapboxTileUrl = (style: string, accessToken: string): string =>
  `https://api.mapbox.com/styles/v1/${style}/tiles/256/{z}/{x}/{y}@2x?access_token=${encodeURIComponent(accessToken)}`;

/**
 * Mapbox style matching the color scheme when a token is configured, OpenStreetMap otherwise.
 * OpenStreetMap has no dark style; `map.scss` darkens its tiles with a filter instead.
 */
export const createTileLayer = (
  mapboxAccessToken: string,
  colorScheme: ResolvedColorScheme
): L.TileLayer =>
  mapboxAccessToken === ''
    ? L.tileLayer(OPEN_STREET_MAP_TILE_URL, {
        attribution: OPEN_STREET_MAP_ATTRIBUTION,
        maxZoom: MAXIMUM_ZOOM,
        className: 'open-street-map-tiles',
      })
    : L.tileLayer(mapboxTileUrl(MAPBOX_STYLES[colorScheme], mapboxAccessToken), {
        attribution: MAPBOX_ATTRIBUTION,
        maxZoom: MAXIMUM_ZOOM,
      });
