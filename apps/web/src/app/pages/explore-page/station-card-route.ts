import { PRIMARY_OUTLET } from '@angular/router';
import type { UrlTree } from '@angular/router';

/** `/stations/<id>` opens the card of a station. */
export const stationIdentifierIn = (url: UrlTree | undefined): string | undefined => {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments ?? [];
  return segments.length === 2 && segments[0]?.path === 'stations' ? segments[1]?.path : undefined;
};
