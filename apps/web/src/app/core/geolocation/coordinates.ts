/** A point on earth in decimal degrees (WGS 84), e.g. the user's position or a map center. */
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export const isSamePosition = (
  first: Coordinates | undefined,
  second: Coordinates | undefined
): boolean => first?.latitude === second?.latitude && first?.longitude === second?.longitude;
