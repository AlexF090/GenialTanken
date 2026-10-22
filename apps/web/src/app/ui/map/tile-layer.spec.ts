import { L } from './leaflet';
import { createTileLayer } from './tile-layer';

const withMap = (callback: (map: L.Map) => void): void => {
  const container = document.createElement('div');
  document.body.append(container);
  const map = L.map(container).setView([48.86, 2.34], 13);
  try {
    callback(map);
  } finally {
    map.remove();
    container.remove();
  }
};

describe('createTileLayer', () => {
  // The zoom in tile URLs comes from the map the layer is on.
  const tileUrl = (layer: L.TileLayer): string => {
    let url = '';
    withMap(map => {
      map.setZoom(3, { animate: false });
      layer.addTo(map);
      url = layer.getTileUrl(Object.assign(new L.Point(1, 2), { z: 3 }));
    });
    return url;
  };

  it('uses OpenStreetMap in both color schemes without a Mapbox token', () => {
    expect(tileUrl(createTileLayer('', 'light'))).toBe('https://tile.openstreetmap.org/3/1/2.png');
    expect(tileUrl(createTileLayer('', 'dark'))).toBe('https://tile.openstreetmap.org/3/1/2.png');
  });

  it('uses the dark Mapbox style in the dark color scheme', () => {
    expect(tileUrl(createTileLayer('token', 'light'))).toBe(
      'https://api.mapbox.com/styles/v1/alexf090/cl2uhl8gx008p14qop192uczn/tiles/256/3/1/2@2x?access_token=token'
    );
    expect(tileUrl(createTileLayer('token', 'dark'))).toBe(
      'https://api.mapbox.com/styles/v1/mapbox/dark-v11/tiles/256/3/1/2@2x?access_token=token'
    );
  });
});
