import type { MockInstance } from 'vitest';
import { L, MAXIMUM_ZOOM } from './leaflet-layers';
import { revealMarker } from './reveal-marker';

const MAP_CENTER: L.LatLngTuple = [48.86, 2.34];
const FAR_AWAY: L.LatLngTuple = [43.3, 5.37];

interface RevealSetup {
  map: L.Map;
  group: L.MarkerClusterGroup;
  marker: L.Marker;
  onShown: ReturnType<typeof vi.fn<() => void>>;
}

describe('revealMarker', () => {
  let container: HTMLElement;
  let map: L.Map;

  beforeEach(() => {
    // jsdom has no layout; Leaflet reads the map size from the container.
    container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 400 });
    Object.defineProperty(container, 'clientHeight', { value: 400 });
    document.body.append(container);
    map = L.map(container, {
      maxZoom: MAXIMUM_ZOOM,
      zoomAnimation: false,
      fadeAnimation: false,
    }).setView(MAP_CENTER, 13);
  });

  afterEach(() => {
    map.remove();
    container.remove();
  });

  const setUp = (position: L.LatLngTuple): RevealSetup => {
    const group = L.markerClusterGroup({ animate: false }).addTo(map);
    const marker = L.marker(position);
    group.addLayer(marker);
    return { map, group, marker, onShown: vi.fn<() => void>() };
  };

  /** Holds the pan, as if its animation were still running; `finishPan` completes it. */
  const holdPan = (setup: RevealSetup): { panTo: MockInstance; finishPan: () => void } => {
    const panTo = vi.spyOn(setup.map, 'panTo').mockReturnValue(setup.map);
    return {
      panTo,
      finishPan: () => {
        setup.map.setView(setup.marker.getLatLng(), setup.map.getZoom(), { animate: false });
      },
    };
  };

  it('reports a marker that is already shown on its own right away', () => {
    const setup = setUp(MAP_CENTER);

    const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

    expect(setup.onShown).toHaveBeenCalledOnce();
    expect(reveal.isPending).toBe(false);
  });

  it('pans to a marker outside the map and reports it once it is shown', () => {
    const setup = setUp(FAR_AWAY);
    const { panTo, finishPan } = holdPan(setup);

    const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

    expect(panTo).toHaveBeenCalledWith(setup.marker.getLatLng());
    expect(reveal.isPending).toBe(true);
    expect(setup.onShown).not.toHaveBeenCalled();

    finishPan();

    expect(setup.onShown).toHaveBeenCalledOnce();
    expect(reveal.isPending).toBe(false);
  });

  it('stops waiting when cancelled', () => {
    const setup = setUp(FAR_AWAY);
    const { finishPan } = holdPan(setup);
    const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

    reveal.cancel();
    finishPan();

    expect(reveal.isPending).toBe(false);
    expect(setup.onShown).not.toHaveBeenCalled();
  });

  it('ends when the marker leaves the group before it is shown', () => {
    const setup = setUp(FAR_AWAY);
    const { finishPan } = holdPan(setup);
    const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

    setup.group.removeLayer(setup.marker);

    expect(finishPan).not.toThrow();
    expect(reveal.isPending).toBe(false);
    expect(setup.onShown).not.toHaveBeenCalled();
  });

  it('zooms into the cluster of a marker until it is shown on its own', () => {
    const setup = setUp(MAP_CENTER);
    // A neighbor a few meters away clusters with the marker at this zoom level.
    setup.group.addLayer(L.marker([MAP_CENTER[0] + 0.0005, MAP_CENTER[1]]));
    expect(setup.group.getVisibleParent(setup.marker)).toBeInstanceOf(L.MarkerCluster);

    revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

    expect(setup.onShown).toHaveBeenCalledOnce();
    expect(setup.map.getZoom()).toBeGreaterThan(13);
  });

  it('pans only once when the marker stays out of sight after the pan', () => {
    const setup = setUp(FAR_AWAY);
    const { panTo } = holdPan(setup);
    const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

    // The pan ends without bringing the marker into view, as on a map without a size.
    setup.map.fire('moveend');

    expect(panTo).toHaveBeenCalledOnce();
    expect(reveal.isPending).toBe(false);
    expect(setup.onShown).not.toHaveBeenCalled();
  });

  describe('at maximum zoom', () => {
    /** A neighbor so close that the two stay clustered even at maximum zoom. */
    const setUpClusterAtMaximumZoom = (): RevealSetup & { cluster: L.MarkerCluster } => {
      map.setView(MAP_CENTER, MAXIMUM_ZOOM, { animate: false });
      const setup = setUp(MAP_CENTER);
      setup.group.addLayer(L.marker([MAP_CENTER[0] + 0.000001, MAP_CENTER[1]]));
      const cluster: unknown = setup.group.getVisibleParent(setup.marker);
      if (!(cluster instanceof L.MarkerCluster)) {
        throw new Error('The marker is not clustered at maximum zoom');
      }
      return { ...setup, cluster };
    };

    it('spiderfies the cluster and reports the marker once it is spiderfied', () => {
      const setup = setUpClusterAtMaximumZoom();
      const spiderfy = vi.spyOn(setup.cluster, 'spiderfy').mockImplementation(() => undefined);

      const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

      expect(spiderfy).toHaveBeenCalledOnce();
      expect(setup.map.getZoom()).toBe(MAXIMUM_ZOOM);
      expect(reveal.isPending).toBe(true);
      expect(setup.onShown).not.toHaveBeenCalled();

      setup.group.fire('spiderfied');

      expect(setup.onShown).toHaveBeenCalledOnce();
      expect(reveal.isPending).toBe(false);
    });

    it('reports the marker after a real spiderfy', () => {
      const setup = setUpClusterAtMaximumZoom();

      revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

      expect(setup.onShown).toHaveBeenCalledOnce();
    });

    it('stops waiting for the spiderfy when cancelled', () => {
      const setup = setUpClusterAtMaximumZoom();
      vi.spyOn(setup.cluster, 'spiderfy').mockImplementation(() => undefined);
      const reveal = revealMarker(setup.map, setup.group, setup.marker, setup.onShown);

      reveal.cancel();
      setup.group.fire('spiderfied');

      expect(reveal.isPending).toBe(false);
      expect(setup.onShown).not.toHaveBeenCalled();
    });
  });
});
