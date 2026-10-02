// Leaflet has to be imported before the marker cluster plugin, which extends the global `L`.
import L from 'leaflet';
import 'leaflet.markercluster';
import type { Coordinates } from '../../core/geolocation/coordinates';

const MAPBOX_TILE_URL =
  'https://api.mapbox.com/styles/v1/alexf090/cl2uhl8gx008p14qop192uczn/tiles/256/{z}/{x}/{y}@2x?access_token=';
const MAPBOX_ATTRIBUTION =
  '© <a href="https://www.mapbox.com/about/maps/">Mapbox</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OPEN_STREET_MAP_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const OPEN_STREET_MAP_ATTRIBUTION =
  '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>-Mitwirkende';
const MAXIMUM_ZOOM = 19;

/** Mapbox style of the legacy app when a token is configured, OpenStreetMap otherwise. */
export const createTileLayer = (mapboxAccessToken: string): L.TileLayer =>
  mapboxAccessToken === ''
    ? L.tileLayer(OPEN_STREET_MAP_TILE_URL, {
        attribution: OPEN_STREET_MAP_ATTRIBUTION,
        maxZoom: MAXIMUM_ZOOM,
      })
    : L.tileLayer(`${MAPBOX_TILE_URL}${encodeURIComponent(mapboxAccessToken)}`, {
        attribution: MAPBOX_ATTRIBUTION,
        maxZoom: MAXIMUM_ZOOM,
      });

const STATION_ICON = L.icon({
  iconUrl: 'gasoline-pump.png',
  iconSize: [26, 29],
  iconAnchor: [13, 29],
  popupAnchor: [0, -26],
});

export const createStationMarker = (
  coordinates: Coordinates,
  accessibleName: string,
  options: { interactive: boolean }
): L.Marker =>
  L.marker([coordinates.latitude, coordinates.longitude], {
    icon: STATION_ICON,
    alt: accessibleName,
    interactive: options.interactive,
    keyboard: options.interactive,
  });

export const OWN_POSITION_LABEL = 'Du bist hier!';

export const createOwnPositionMarker = (coordinates: Coordinates): L.Marker =>
  L.marker([coordinates.latitude, coordinates.longitude], {
    icon: L.divIcon({ className: 'own-position-marker', iconSize: [20, 20] }),
    title: 'Dein Standort',
    keyboard: false,
    zIndexOffset: 1000,
  }).bindTooltip(OWN_POSITION_LABEL, { permanent: true, direction: 'top', offset: [0, -10] });

export { L };

/**
 * Removes a map even while a pan or zoom animation is still running; a plain `remove()` lets
 * pending animation frames access the already removed panes (`_leaflet_pos` of undefined).
 */
export const destroyMap = (map: L.Map): void => {
  map.stop();
  map.off();
  map.remove();
};
