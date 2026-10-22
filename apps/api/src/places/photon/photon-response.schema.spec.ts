import { parsePhotonFeatures } from './photon-response.schema.js';

const featureAt = (osmIdentifier: number, coordinates: [number, number]) => ({
  type: 'Feature',
  properties: { osm_type: 'N', osm_id: osmIdentifier, name: 'Bastille', countrycode: 'FR' },
  geometry: { type: 'Point', coordinates },
});

describe('parsePhotonFeatures', () => {
  it.each([
    ['a latitude above 90', [2.369, 90.5]],
    ['a latitude below -90', [2.369, -91]],
    ['a longitude above 180', [180.1, 48.853]],
    ['a longitude below -180', [-200, 48.853]],
  ] as const)('drops a feature with %s and keeps the valid ones', (_description, coordinates) => {
    const features = parsePhotonFeatures([
      featureAt(1, [2.369, 48.853]),
      featureAt(2, [...coordinates]),
      { type: 'Feature', properties: {}, geometry: null },
      featureAt(3, [-1.562, 47.219]),
    ]);

    expect(features.map(feature => feature.properties.osm_id)).toEqual([1, 3]);
  });
});
