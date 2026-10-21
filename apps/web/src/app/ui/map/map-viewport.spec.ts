import { L } from './leaflet-layers';
import {
  centerForVisibleArea,
  isSameViewportPadding,
  NO_VIEWPORT_PADDING,
  searchAreaBounds,
  toPaddingOptions,
  visibleAreaCenter,
} from './map-viewport';
import type { ViewportPadding } from './map-viewport';

const MAP_CENTER: L.LatLngTuple = [48.86, 2.34];
const OVERLAYS: ViewportPadding = { top: 40, right: 0, bottom: 400, left: 100 };

/** Pixel offset of a point from a map center, at the current zoom. */
const offsetFrom = (map: L.Map, center: L.LatLng, point: L.LatLngExpression): L.Point =>
  map.project(point, map.getZoom()).subtract(map.project(center, map.getZoom())).round();

describe('map viewport', () => {
  let container: HTMLElement;
  let map: L.Map;

  beforeEach(() => {
    // jsdom has no layout; Leaflet reads the map size from the container.
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 800 });
    Object.defineProperty(container, 'clientHeight', { value: 600 });
    document.body.append(container);
    map = L.map(container, { zoomAnimation: false, fadeAnimation: false }).setView(MAP_CENTER, 13);
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  describe('centerForVisibleArea', () => {
    it('is the point itself without overlays and shifts by half of each overlay', () => {
      const point = L.latLng(48.86, 2.34);

      const noOverlay = centerForVisibleArea(map, point, NO_VIEWPORT_PADDING);
      const withOverlays = centerForVisibleArea(map, point, OVERLAYS);

      expect(offsetFrom(map, noOverlay, point)).toEqual(L.point(0, 0));
      expect(offsetFrom(map, withOverlays, point)).toEqual(L.point(50, -180));
    });
  });

  describe('visibleAreaCenter', () => {
    it('finds the point that was centered in the visible area', () => {
      const point = L.latLng(48.87, 2.35);
      map.setView(centerForVisibleArea(map, point, OVERLAYS), map.getZoom(), { animate: false });

      const center = visibleAreaCenter(map, OVERLAYS);

      const offset = offsetFrom(map, L.latLng(center.latitude, center.longitude), point);
      expect(offset.equals(L.point(0, 0))).toBe(true);
    });
  });

  describe('toPaddingOptions', () => {
    it('adds the edge spacing to every side of the overlays', () => {
      expect(toPaddingOptions(OVERLAYS)).toEqual({
        paddingTopLeft: [124, 64],
        paddingBottomRight: [24, 424],
      });
    });
  });

  describe('isSameViewportPadding', () => {
    it('compares every side', () => {
      expect(isSameViewportPadding(OVERLAYS, { ...OVERLAYS })).toBe(true);
      expect(isSameViewportPadding(OVERLAYS, { ...OVERLAYS, left: 0 })).toBe(false);
      expect(isSameViewportPadding(OVERLAYS, { ...OVERLAYS, bottom: 0 })).toBe(false);
    });
  });

  describe('searchAreaBounds', () => {
    it('reaches the radius from the center in every direction', () => {
      const center = { latitude: 48.8584, longitude: 2.2945 };
      const centerPoint = L.latLng(center.latitude, center.longitude);

      const bounds = searchAreaBounds(center, 5);

      expect(centerPoint.distanceTo([bounds.getNorth(), center.longitude])).toBeCloseTo(5000, -2);
      expect(centerPoint.distanceTo([center.latitude, bounds.getEast()])).toBeCloseTo(5000, -2);
    });
  });
});
