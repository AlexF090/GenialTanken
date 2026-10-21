export const PHOTON_SEARCH_PATH = '/api';

/** Photon answer for "bastille" (recorded, shortened): a duplicate, a nameless French address and a Dutch street included. */
export const bastilleFeatures = [
  {
    type: 'Feature',
    properties: {
      osm_type: 'N',
      osm_id: 1584432760,
      osm_key: 'railway',
      osm_value: 'station',
      type: 'house',
      name: 'Bastille',
      street: 'Place de la Bastille',
      city: 'Paris',
      state: 'Île-de-France',
      country: 'Frankreich',
      postcode: '75011',
      countrycode: 'FR',
    },
    geometry: { type: 'Point', coordinates: [2.3691871, 48.8536788] },
  },
  {
    type: 'Feature',
    properties: {
      osm_type: 'W',
      osm_id: 129039250,
      osm_key: 'highway',
      osm_value: 'residential',
      type: 'street',
      name: 'Bastille',
      city: 'Berkel en Rodenrijs',
      country: 'Niederlande',
      postcode: '2652 HW',
      countrycode: 'NL',
    },
    geometry: { type: 'Point', coordinates: [4.4615617, 51.9853178] },
  },
  {
    type: 'Feature',
    properties: {
      osm_type: 'N',
      osm_id: 1584432760,
      osm_key: 'railway',
      osm_value: 'station',
      type: 'house',
      name: 'Bastille',
      countrycode: 'FR',
    },
    geometry: { type: 'Point', coordinates: [2.3691871, 48.8536788] },
  },
  {
    type: 'Feature',
    properties: {
      osm_type: 'N',
      osm_id: 206670863,
      osm_key: 'place',
      osm_value: 'house',
      type: 'house',
      street: 'Rue de la Bastille',
      housenumber: '4',
      city: 'Nantes',
      country: 'Frankreich',
      postcode: '44000',
      countrycode: 'FR',
    },
    geometry: { type: 'Point', coordinates: [-1.5626711, 47.2196414] },
  },
];

export const photonResponse = (features: readonly unknown[]) => ({
  type: 'FeatureCollection',
  features,
});
