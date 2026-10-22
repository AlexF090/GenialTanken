import { L } from './leaflet';

export interface MarkerReveal {
  /** Whether a step still waits for the map or the cluster group. */
  readonly isPending: boolean;
  /** Stops the steps still pending. */
  cancel(): void;
}

/**
 * Brings a marker of a cluster group into view: pans to it when neither the marker nor one of its
 * clusters is on screen, zooms into its clusters until it is shown on its own (spiderfying a
 * cluster at maximum zoom) and then calls `onShown`.
 *
 * Replaces `MarkerClusterGroup.zoomToShowLayer`, whose `moveend` listener cannot be removed and
 * throws on every later map move once the marker has left the group before it was shown. Here
 * each step waits with its own listener, which `cancel` removes, and a marker that has left the
 * group ends the reveal.
 */
export const revealMarker = (
  map: L.Map,
  group: L.MarkerClusterGroup,
  marker: L.Marker,
  onShown: () => void
): MarkerReveal => {
  let cancelPendingStep: (() => void) | undefined;
  let hasPannedToMarker = false;

  const continueAfter = (target: L.Evented, eventType: 'moveend' | 'animationend'): void => {
    const listener = (): void => {
      cancelPendingStep = undefined;
      showNextLevel();
    };
    target.once(eventType, listener);
    cancelPendingStep = () => {
      target.off(eventType, listener);
    };
  };

  function showNextLevel(): void {
    if (!group.hasLayer(marker)) {
      return;
    }
    // Typed as never null, but it is null while neither the marker nor a cluster of it is shown.
    const visibleParent: L.Marker | null = group.getVisibleParent(marker);
    if (visibleParent === marker) {
      onShown();
      return;
    }
    if (visibleParent instanceof L.MarkerCluster) {
      if (map.getZoom() >= map.getMaxZoom()) {
        const listener = (): void => {
          cancelPendingStep = undefined;
          onShown();
        };
        group.once('spiderfied', listener);
        cancelPendingStep = () => {
          group.off('spiderfied', listener);
        };
        visibleParent.spiderfy();
        return;
      }
      // The group signals with `animationend` that its clusters match the new zoom level.
      continueAfter(group, 'animationend');
      visibleParent.zoomToBounds();
      return;
    }
    // Panning once is enough; a map without a size never shows anything.
    if (hasPannedToMarker) {
      return;
    }
    hasPannedToMarker = true;
    continueAfter(map, 'moveend');
    map.panTo(marker.getLatLng());
  }

  showNextLevel();
  return {
    get isPending() {
      return cancelPendingStep !== undefined;
    },
    cancel() {
      cancelPendingStep?.();
      cancelPendingStep = undefined;
    },
  };
};
