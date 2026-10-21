import type { PhotonFeature } from './photon-response.schema.js';
import { toPlaceFromPhoton } from './to-place-from-photon.js';

const photonFeature = (
  properties: Partial<PhotonFeature['properties']>,
  coordinates: [number, number] = [2.3691871, 48.8536788]
): PhotonFeature => ({
  type: 'Feature',
  properties: { osm_type: 'N', osm_id: 1584432760, ...properties },
  geometry: { type: 'Point', coordinates },
});

describe('toPlaceFromPhoton', () => {
  it('maps a French place with postcode and city', () => {
    const feature = photonFeature({
      name: 'Place de la Bastille',
      postcode: '75011',
      city: 'Paris',
      countrycode: 'FR',
    });

    expect(toPlaceFromPhoton(feature)).toEqual({
      id: 'N1584432760',
      name: 'Place de la Bastille',
      description: '75011 Paris, Frankreich',
      country: 'FR',
      latitude: 48.8536788,
      longitude: 2.3691871,
    });
  });

  it('describes a city without postcode by its country only', () => {
    const feature = photonFeature(
      { osm_type: 'R', osm_id: 120965, name: 'Lyon', countrycode: 'FR', type: 'city' },
      [4.8320114, 45.7578137]
    );

    expect(toPlaceFromPhoton(feature)).toEqual({
      id: 'R120965',
      name: 'Lyon',
      description: 'Frankreich',
      country: 'FR',
      latitude: 45.7578137,
      longitude: 4.8320114,
    });
  });

  it('joins postcode or city alone with the country', () => {
    expect(
      toPlaceFromPhoton(photonFeature({ name: 'A', city: 'Paris', countrycode: 'FR' }))?.description
    ).toBe('Paris, Frankreich');
    expect(
      toPlaceFromPhoton(photonFeature({ name: 'A', postcode: '69002', countrycode: 'FR' }))
        ?.description
    ).toBe('69002, Frankreich');
  });

  it('names an address without a name by street and house number', () => {
    const feature = photonFeature({
      street: 'Rue de la République',
      housenumber: '1',
      postcode: '69002',
      city: 'Lyon',
      countrycode: 'FR',
    });

    expect(toPlaceFromPhoton(feature)?.name).toBe('Rue de la République 1');
  });

  it('names an address without a house number by its street', () => {
    const feature = photonFeature({ street: 'Rue de Lyon', countrycode: 'FR' });

    expect(toPlaceFromPhoton(feature)?.name).toBe('Rue de Lyon');
  });

  it('accepts lowercase country codes', () => {
    const feature = photonFeature({ name: 'Paris', countrycode: 'fr' });

    expect(toPlaceFromPhoton(feature)?.country).toBe('FR');
  });

  it.each([
    ['a country without fuel prices', { name: 'Bastille', countrycode: 'NL' }],
    ['a German place inside the bounding box', { name: 'Kehl', countrycode: 'DE' }],
    ['a missing country', { name: 'Bastille' }],
    ['a missing name and street', { housenumber: '1', countrycode: 'FR' }],
    ['a blank name', { name: '  ', countrycode: 'FR' }],
  ])('skips a place with %s', (_description, properties) => {
    expect(toPlaceFromPhoton(photonFeature(properties))).toBeNull();
  });
});
