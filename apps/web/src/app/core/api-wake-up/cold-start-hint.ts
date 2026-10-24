import type { Signal } from '@angular/core';
import { injectHasLastedFor } from '../time/has-lasted-for';

/** The free API host sleeps when idle; its first answer can take about a minute. */
export const COLD_START_HINT_DELAY_IN_MILLISECONDS = 4000;
export const COLD_START_HINT =
  'Der Server wird gerade gestartet. Das kann beim ersten Aufruf bis zu einer Minute dauern.';

/** True once `isLoading` has lasted `COLD_START_HINT_DELAY_IN_MILLISECONDS`, until it ends. */
export function injectShowsColdStartHint(isLoading: Signal<boolean>): Signal<boolean> {
  return injectHasLastedFor(isLoading, COLD_START_HINT_DELAY_IN_MILLISECONDS);
}
