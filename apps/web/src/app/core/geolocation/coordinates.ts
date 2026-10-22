import type { Coordinates } from '@genialtanken/contracts';

export const isSamePosition = (
  first: Coordinates | undefined,
  second: Coordinates | undefined
): boolean => first?.latitude === second?.latitude && first?.longitude === second?.longitude;
