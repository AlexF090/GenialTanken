import type { SearchCenter } from '../../core/search-center/search-center';

const describeCenter = (center: SearchCenter): string =>
  center.source === 'map-area' ? 'die Kartenmitte' : center.label;

const describeStationCount = (count: number): string =>
  count === 1 ? '1 Tankstelle' : `${String(count)} Tankstellen`;

/** "3 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris", with a no-break space before "km". */
export const describeResult = (
  stationCount: number,
  radiusInKilometers: number,
  center: SearchCenter
): string =>
  `${describeStationCount(stationCount)} im Umkreis von ${String(radiusInKilometers)}\u00a0km um ${describeCenter(center)}`;
