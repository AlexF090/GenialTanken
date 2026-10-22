import { FUEL_TYPES } from '@genialtanken/contracts';
import type { FuelType } from '@genialtanken/contracts';
import type { LabeledOption } from './labeled-option';

export interface FuelTypeLabel {
  /** Compact label for the header badge and the settings options. */
  short: string;
  /** Product name as shown at the pump, e.g. on the detail page. */
  long: string;
}

/**
 * The only place in the web app that knows individual fuel types. Adding a fuel type to
 * `FUEL_TYPES` in @genialtanken/contracts makes the compiler ask for its labels here.
 */
export const FUEL_TYPE_LABELS: Record<FuelType, FuelTypeLabel> = {
  e5: { short: 'E5', long: 'Super E5' },
  e10: { short: 'E10', long: 'Super E10' },
  superPlus: { short: 'Super Plus', long: 'Super Plus' },
  diesel: { short: 'Diesel', long: 'Diesel' },
  e85: { short: 'E85', long: 'E85' },
  lpg: { short: 'LPG', long: 'LPG' },
};

/** Every fuel type as an option, labeled short (compact controls) or long (menus). */
export const fuelTypeOptions = (
  labelLength: keyof FuelTypeLabel
): readonly LabeledOption<FuelType>[] =>
  FUEL_TYPES.map(fuelType => ({ value: fuelType, label: FUEL_TYPE_LABELS[fuelType][labelLength] }));
