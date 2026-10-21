/**
 * About 100 m; rounding the position sent upstream lets nearby users share cached responses.
 * Exact distances are computed afterwards from the unrounded position.
 */
const COORDINATE_DECIMALS = 3;

export const roundCoordinate = (coordinate: number): string =>
  String(Number(coordinate.toFixed(COORDINATE_DECIMALS)));
