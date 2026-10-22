import { formatPriceParts } from '../../core/formatting/number-format';
import type { L } from './leaflet';

// Marker content is built from DOM nodes with `textContent`: station names and place labels come
// from external sources and must never be parsed as HTML.
export const createMarkerElement = (
  tagName: 'div' | 'span' | 'sup',
  className: string,
  text?: string
): HTMLElement => {
  const element = document.createElement(tagName);
  element.className = className;
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
};

export const createAccessibleName = (name: string): HTMLElement =>
  createMarkerElement('span', 'visually-hidden', name);

/** "1,85⁹" for the eyes; screen readers get the accessible name instead. */
export const createPriceDigits = (className: string, priceInEuro: number | null): HTMLElement => {
  const digits = createMarkerElement('span', className);
  digits.setAttribute('aria-hidden', 'true');
  if (priceInEuro === null) {
    digits.textContent = '–';
    return digits;
  }
  const { leadingDigits, tenthOfCent } = formatPriceParts(priceInEuro);
  digits.append(leadingDigits, createMarkerElement('sup', '', tenthOfCent));
  return digits;
};

/** Visible word for the cheapest price, so it is not told by the green alone (WCAG 1.4.1). */
export const CHEAPEST_CAPTION = 'günstigst';

/** Screen readers hear `CHEAPEST_PRICE_LABEL` in the accessible name instead. */
export const createCheapestCaption = (className: string): HTMLElement => {
  const caption = createMarkerElement('span', className, CHEAPEST_CAPTION);
  caption.setAttribute('aria-hidden', 'true');
  return caption;
};

/** Pins are drawn by their inner element in `map.scss` around the zero-sized icon. */
export const ZERO_SIZE: L.PointTuple = [0, 0];
/**
 * Interactive markers keep their content size (a zero-sized button would have no hit box and
 * count as invisible); `map.scss` moves them onto their point with the CSS `translate` property.
 */
export const CONTENT_SIZE = undefined;
