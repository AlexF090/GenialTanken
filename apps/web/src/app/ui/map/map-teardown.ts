import type { L } from './leaflet';

/**
 * Ends a running zoom animation at once. Leaflet's `stop()` and `remove()` only cancel pan and fly
 * animations; a zoom animation's 250 ms fallback timeout would otherwise run on the removed panes
 * (`_leaflet_pos` of undefined). Leaflet offers no public API for this.
 */
const finishZoomAnimation = (map: L.Map): void => {
  if ('_onZoomTransitionEnd' in map && typeof map._onZoomTransitionEnd === 'function') {
    Reflect.apply(map._onZoomTransitionEnd, map, []);
  }
};

/**
 * Removes a map even while a pan or zoom animation is still running; a plain `remove()` lets
 * pending animation frames and the zoom fallback timeout access the already removed panes
 * (`_leaflet_pos` of undefined).
 */
export const destroyMap = (map: L.Map): void => {
  map.stop();
  finishZoomAnimation(map);
  map.off();
  map.remove();
};
