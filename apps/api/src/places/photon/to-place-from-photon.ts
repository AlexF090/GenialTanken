import { countryCodeSchema } from '@genialtanken/contracts';
import type { CountryCode, Place } from '@genialtanken/contracts';
import type { PhotonFeature } from './photon-response.schema.js';

const GERMAN_COUNTRY_NAMES: Record<CountryCode, string> = {
  FR: 'Frankreich',
};

const joinPresent = (parts: (string | undefined)[], separator: string): string =>
  parts
    .map(part => part?.trim())
    .filter(part => part !== undefined && part.length > 0)
    .join(separator);

/** The name, else street and house number; empty when neither name nor street is known. */
const toName = ({ name, street, housenumber }: PhotonFeature['properties']): string => {
  const trimmedName = name?.trim() ?? '';
  if (trimmedName.length > 0) {
    return trimmedName;
  }
  const trimmedStreet = street?.trim() ?? '';
  return trimmedStreet.length === 0 ? '' : joinPresent([trimmedStreet, housenumber], ' ');
};

/**
 * Maps a Photon feature to a place suggestion; `null` for places outside the countries with fuel
 * prices or without anything to call them by.
 */
export const toPlaceFromPhoton = ({ properties, geometry }: PhotonFeature): Place | null => {
  const country = countryCodeSchema.safeParse(properties.countrycode?.toUpperCase());
  if (!country.success) {
    return null;
  }

  const name = toName(properties);
  if (name.length === 0) {
    return null;
  }

  const [longitude, latitude] = geometry.coordinates;
  return {
    id: `${properties.osm_type}${String(properties.osm_id)}`,
    name,
    description: joinPresent(
      [
        joinPresent([properties.postcode, properties.city], ' '),
        GERMAN_COUNTRY_NAMES[country.data],
      ],
      ', '
    ),
    country: country.data,
    latitude,
    longitude,
  };
};
