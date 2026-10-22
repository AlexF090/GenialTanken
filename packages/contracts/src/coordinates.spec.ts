import { describe, expect, it } from 'vitest';
import { distanceInMeters, latitudeSchema, longitudeSchema } from './index.js';

const PARIS_NOTRE_DAME = { latitude: 48.853, longitude: 2.3499 };
const LONDON_TOWER_BRIDGE = { latitude: 51.5055, longitude: -0.0754 };

describe('distanceInMeters', () => {
  it('is zero for the same position', () => {
    expect(distanceInMeters(PARIS_NOTRE_DAME, PARIS_NOTRE_DAME)).toBe(0);
  });

  it('measures one degree of latitude along a meridian as about 111.2 km', () => {
    expect(
      distanceInMeters({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 })
    ).toBeCloseTo(111_195, 0);
  });

  it('measures one degree of longitude at 60° north as half of that at the equator', () => {
    expect(
      distanceInMeters({ latitude: 60, longitude: 10 }, { latitude: 60, longitude: 11 })
    ).toBeCloseTo(55_597, 0);
  });

  it('measures Paris to London as about 342 km in both directions', () => {
    const parisToLondon = distanceInMeters(PARIS_NOTRE_DAME, LONDON_TOWER_BRIDGE);

    expect(Math.round(parisToLondon / 1000)).toBe(342);
    expect(distanceInMeters(LONDON_TOWER_BRIDGE, PARIS_NOTRE_DAME)).toBe(parisToLondon);
  });
});

describe('latitudeSchema', () => {
  it.each([-90, 0, 90])('accepts %s', latitude => {
    expect(latitudeSchema.parse(latitude)).toBe(latitude);
  });

  it.each([-90.1, 90.1])('rejects %s', latitude => {
    expect(latitudeSchema.safeParse(latitude).success).toBe(false);
  });
});

describe('longitudeSchema', () => {
  it.each([-180, 0, 180])('accepts %s', longitude => {
    expect(longitudeSchema.parse(longitude)).toBe(longitude);
  });

  it.each([-180.1, 180.1])('rejects %s', longitude => {
    expect(longitudeSchema.safeParse(longitude).success).toBe(false);
  });
});
