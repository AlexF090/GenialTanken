import { formatPrice } from '../../core/formatting/number-format';
import { CHEAPEST_PRICE_LABEL, NO_PRICE_LABEL } from '../../core/stations/price-labels';
import type { PriceLevel } from '../../core/stations/price-level';
import { L } from './leaflet';
import {
  CHEAPEST_CAPTION,
  CONTENT_SIZE,
  createAccessibleName,
  createCheapestCaption,
  createMarkerElement,
  createPriceDigits,
} from './marker-elements';

export interface PriceTagIconOptions {
  /** Usually the station title; price and highlight are appended. */
  accessibleName: string;
  priceInEuro: number | null;
  /** Tints the tag from cheap to dear; missing without a price. */
  priceLevel?: PriceLevel;
  isCheapest: boolean;
  isSelected: boolean;
}

const priceTagAccessibleName = ({
  accessibleName,
  priceInEuro,
  isCheapest,
}: PriceTagIconOptions): string => {
  if (priceInEuro === null) {
    return `${accessibleName}, ${NO_PRICE_LABEL}`;
  }
  const name = `${accessibleName}, ${formatPrice(priceInEuro)}`;
  return isCheapest ? `${name}, ${CHEAPEST_PRICE_LABEL}` : name;
};

/** A small price board with a pointer to the station's location. */
export const createPriceTagIcon = (options: PriceTagIconOptions): L.DivIcon => {
  const tag = createMarkerElement('div', 'price-tag');
  tag.classList.toggle('price-tag--cheapest', options.isCheapest);
  tag.classList.toggle('price-tag--selected', options.isSelected);
  tag.classList.toggle('price-tag--without-price', options.priceInEuro === null);
  if (options.priceLevel !== undefined) {
    tag.classList.add(`price-tag--${options.priceLevel}`);
  }
  tag.append(
    createAccessibleName(priceTagAccessibleName(options)),
    createPriceDigits('price-tag__price', options.priceInEuro)
  );
  if (options.isCheapest) {
    tag.append(createCheapestCaption('price-tag__caption'));
  }
  return L.divIcon({ html: tag, className: 'price-tag-marker', iconSize: CONTENT_SIZE });
};

/** What a cluster icon needs to know about each of its stations. */
export interface ClusteredStation {
  readonly stationPriceInEuro: number | null;
  readonly stationPriceLevel: PriceLevel | undefined;
  readonly isCheapestStation: boolean;
}

/** Number of stations and the lowest price among them, highlighted if it is the cheapest. */
export const createPriceClusterIcon = (
  stations: readonly ClusteredStation[],
  stationCount: number
): L.DivIcon => {
  const prices = stations.flatMap(station =>
    station.stationPriceInEuro === null ? [] : [station.stationPriceInEuro]
  );
  const minimumPrice = prices.length === 0 ? null : Math.min(...prices);
  const accessibleName =
    minimumPrice === null
      ? `${String(stationCount)} Tankstellen, ${NO_PRICE_LABEL}`
      : `${String(stationCount)} Tankstellen, ab ${formatPrice(minimumPrice)}`;

  const containsCheapest = stations.some(station => station.isCheapestStation);
  // Tinted like the tag of its lowest price, so a cheap area is visible before zooming in.
  const lowestPriceLevel = stations.find(
    station => station.stationPriceInEuro === minimumPrice
  )?.stationPriceLevel;

  const board = createMarkerElement('div', 'price-cluster');
  board.classList.toggle('price-cluster--cheapest', containsCheapest);
  if (lowestPriceLevel !== undefined) {
    board.classList.add(`price-cluster--${lowestPriceLevel}`);
  }
  const count = createMarkerElement('span', 'price-cluster__count', String(stationCount));
  count.setAttribute('aria-hidden', 'true');
  const lowestPrice = createMarkerElement('span', 'price-cluster__lowest-price');
  lowestPrice.setAttribute('aria-hidden', 'true');
  lowestPrice.append(
    createMarkerElement('span', 'price-cluster__from', 'ab'),
    createPriceDigits('price-cluster__price', minimumPrice)
  );
  if (containsCheapest) {
    lowestPrice.append(createMarkerElement('span', 'price-cluster__caption', CHEAPEST_CAPTION));
  }
  board.append(createAccessibleName(accessibleName), count, lowestPrice);
  return L.divIcon({ html: board, className: 'price-cluster-marker', iconSize: CONTENT_SIZE });
};
