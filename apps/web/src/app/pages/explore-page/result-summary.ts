import { formatKilometers } from '../../core/formatting/number-format';
import { pluralize } from '../../core/formatting/pluralize';
import type { SearchCenter } from '../../core/search-center/search-center';

const describeCenter = (center: SearchCenter): string =>
  center.source === 'map-area' ? 'die Kartenmitte' : center.label;

const describeStationCount = (count: number): string =>
  `${String(count)} ${pluralize(count, 'Tankstelle', 'Tankstellen')}`;

/** "3 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris". */
export const describeResult = (
  stationCount: number,
  radiusInKilometers: number,
  center: SearchCenter
): string =>
  `${describeStationCount(stationCount)} im Umkreis von ${formatKilometers(radiusInKilometers)} um ${describeCenter(center)}`;

/**
 * "3 Tankstellen · 5 km": the visible line under the filters, where the search field already
 * names the place. Screen readers get `describeResult` instead.
 */
export const describeResultBriefly = (stationCount: number, radiusInKilometers: number): string =>
  `${describeStationCount(stationCount)} · ${formatKilometers(radiusInKilometers)}`;

/** "Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden." */
export const describeEmptyResult = (fuelLabel: string, radiusInKilometers: number): string =>
  `Keine Tankstellen mit Preis für ${fuelLabel} im Umkreis von ${formatKilometers(radiusInKilometers)} gefunden.`;
