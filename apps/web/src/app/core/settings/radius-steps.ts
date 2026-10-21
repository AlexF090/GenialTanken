import {
  MAXIMUM_RADIUS_IN_KILOMETERS,
  MINIMUM_RADIUS_IN_KILOMETERS,
} from '@genialtanken/contracts';

/** Radii offered in the radius menu; the settings slider allows every whole kilometer. */
const RADIUS_STEPS_IN_KILOMETERS = [1, 2, 5, 10, 15, 25, 30] as const;

/**
 * Radii for the radius menu within the allowed range. A current radius between the steps (set
 * with the slider) is listed too, so the menu can always show it as chosen.
 */
export const radiusStepsIncluding = (currentRadiusInKilometers: number): readonly number[] =>
  [...new Set([...RADIUS_STEPS_IN_KILOMETERS, currentRadiusInKilometers])]
    .filter(
      radius => radius >= MINIMUM_RADIUS_IN_KILOMETERS && radius <= MAXIMUM_RADIUS_IN_KILOMETERS
    )
    .sort((first, second) => first - second);
