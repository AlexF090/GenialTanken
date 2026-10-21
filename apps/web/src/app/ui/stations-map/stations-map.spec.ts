import { TestBed } from '@angular/core/testing';
import type { Station } from '@genialtanken/contracts';
import { DEFAULT_SEARCH_CENTER } from '../../core/search-center/search-center';
import type { Coordinates } from '../../core/geolocation/coordinates';
import type { SearchCenter } from '../../core/search-center/search-center';
import {
  aralStation,
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { accessibleTextOf, textOf } from '../../../testing/render-page';
import { L } from '../map/leaflet-layers';
import { centerForVisibleArea, StationsMap } from './stations-map';

interface RenderOptions {
  center?: SearchCenter;
  hasSize?: boolean;
  selectedStationIdentifier?: string;
  cheapestStationIdentifiers?: ReadonlySet<string>;
}

/** Pixel offset of a point from the map center the map pans to, at the current zoom. */
const offsetFromPanTarget = (map: L.Map, target: L.LatLng, point: L.LatLngLiteral): L.Point =>
  map.project(point, map.getZoom()).subtract(map.project(target, map.getZoom())).round();

const render = async (stations: readonly Station[], options: RenderOptions = {}) => {
  // jsdom has no layout; Leaflet needs a map size to decide which markers are visible.
  if (options.hasSize ?? true) {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  }
  const fixture = TestBed.createComponent(StationsMap);
  fixture.componentRef.setInput('stations', stations);
  fixture.componentRef.setInput('fuelType', 'e5');
  fixture.componentRef.setInput('center', options.center ?? DEFAULT_SEARCH_CENTER);
  fixture.componentRef.setInput('radiusInKilometers', 5);
  fixture.componentRef.setInput('selectedStationIdentifier', options.selectedStationIdentifier);
  if (options.cheapestStationIdentifiers !== undefined) {
    fixture.componentRef.setInput('cheapestStationIdentifiers', options.cheapestStationIdentifiers);
  }
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const stationSelections: string[] = [];
  fixture.componentInstance.stationSelected.subscribe(stationIdentifier =>
    stationSelections.push(stationIdentifier)
  );
  return { fixture, element, stationSelections };
};

/** Station price tags are toggle buttons; zoom controls and clusters are plain buttons. */
const markerButtons = (element: HTMLElement): HTMLElement[] => [
  ...element.querySelectorAll<HTMLElement>('[role="button"][aria-pressed]'),
];

const markerNames = (element: HTMLElement): string[] =>
  markerButtons(element).map(button => accessibleTextOf(button));

const markerButton = (element: HTMLElement, name: string): HTMLElement => {
  const button = markerButtons(element).find(candidate => accessibleTextOf(candidate) === name);
  if (button === undefined) {
    throw new Error(`No marker named ${name}; found ${markerNames(element).join(' | ')}`);
  }
  return button;
};

describe('StationsMap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a labelled region', async () => {
    const { element } = await render([]);

    expect(element.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe(
      'Karte der Tankstellen'
    );
  });

  it('shows a price tag for every station and points out the cheapest', async () => {
    const { element } = await render([totalStation, carrefourStation, unbrandedStation], {
      cheapestStationIdentifiers: new Set([unbrandedStation.id]),
    });

    expect(markerNames(element).sort()).toEqual([
      '40 Avenue de Flandre, 1,799 €, günstigster Preis',
      'Carrefour Market, 1,839 €',
      'TotalEnergies, 1,859 €',
    ]);
  });

  it('tints every price tag from cheap to dear within the prices shown', async () => {
    const { element } = await render([
      totalStation,
      carrefourStation,
      unbrandedStation,
      aralStation,
    ]);
    const levelOf = (name: string): string | undefined =>
      /price-tag--(low|medium|high)/.exec(
        markerButton(element, name).querySelector('.price-tag')?.className ?? ''
      )?.[1];

    expect(levelOf('40 Avenue de Flandre, 1,799 €')).toBe('low');
    expect(levelOf('Carrefour Market, 1,839 €')).toBe('medium');
    expect(levelOf('TotalEnergies, 1,859 €')).toBe('high');
  });

  it('replaces the price tags when the stations change', async () => {
    const { fixture, element } = await render([totalStation, carrefourStation]);

    fixture.componentRef.setInput('stations', [unbrandedStation]);
    await fixture.whenStable();

    expect(markerNames(element)).toEqual(['40 Avenue de Flandre, 1,799 €']);
  });

  it('reports the station whose price tag is clicked', async () => {
    const { element, stationSelections } = await render([totalStation, carrefourStation]);

    markerButton(element, 'Carrefour Market, 1,839 €').click();

    expect(stationSelections).toEqual([carrefourStation.id]);
  });

  it('reports the station whose price tag is activated with the keyboard', async () => {
    const { element, stationSelections } = await render([totalStation]);

    markerButton(element, 'TotalEnergies, 1,859 €').dispatchEvent(
      new KeyboardEvent('keydown', { key: ' ', bubbles: true })
    );

    expect(stationSelections).toEqual([totalStation.id]);
  });

  it('marks the selected station and follows selection changes from outside', async () => {
    const { fixture, element } = await render([totalStation, carrefourStation], {
      selectedStationIdentifier: totalStation.id,
    });
    const pressedNames = (): string[] =>
      markerButtons(element)
        .filter(button => button.getAttribute('aria-pressed') === 'true')
        .map(button => accessibleTextOf(button));

    expect(pressedNames()).toEqual(['TotalEnergies, 1,859 €']);

    fixture.componentRef.setInput('selectedStationIdentifier', carrefourStation.id);
    await fixture.whenStable();

    expect(pressedNames()).toEqual(['Carrefour Market, 1,839 €']);
  });

  it('keeps working when the stations change while a selected station is being revealed', async () => {
    // Without a size no price tag is in view, so revealing the selection has to move the map.
    const { fixture, element } = await render([totalStation, carrefourStation], {
      hasSize: false,
    });

    fixture.componentRef.setInput('selectedStationIdentifier', carrefourStation.id);
    await fixture.whenStable();
    fixture.componentRef.setInput('stations', [unbrandedStation]);
    await fixture.whenStable();
    fixture.componentRef.setInput('center', {
      latitude: 48.86,
      longitude: 2.34,
      label: 'Dein Standort',
      source: 'own-position',
    });
    await fixture.whenStable();

    expect(textOf(element.querySelector('.leaflet-tooltip'))).toBe('Du bist hier!');
  });

  it('labels the search center', async () => {
    const { fixture, element } = await render([]);

    expect(textOf(element.querySelector('.leaflet-tooltip'))).toBe('Eiffelturm, Paris');

    fixture.componentRef.setInput('center', {
      latitude: 48.86,
      longitude: 2.34,
      label: 'Dein Standort',
      source: 'own-position',
    });
    await fixture.whenStable();

    expect(textOf(element.querySelector('.leaflet-tooltip'))).toBe('Du bist hier!');
  });

  describe('centering a chosen station', () => {
    const coveredByBottomSheet = { top: 0, right: 0, bottom: 400, left: 0 };
    const totalPosition = {
      lat: totalStation.address.latitude,
      lng: totalStation.address.longitude,
    };

    it('centers the price tag in the part of the map left visible by the overlays', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture } = await render([totalStation, carrefourStation]);
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      fixture.componentRef.setInput('selectedStationIdentifier', totalStation.id);
      await fixture.whenStable();

      const map = panTo.mock.contexts.at(-1) as L.Map;
      const panTarget = panTo.mock.calls.at(-1)?.[0];
      if (panTarget === undefined) {
        throw new Error('The map did not pan');
      }
      const target = L.latLng(panTarget);
      // Visible area: 800 × 200 px above the sheet, so the tag sits 200 px above the center.
      expect(offsetFromPanTarget(map, target, totalPosition)).toEqual(L.point(0, -200));
    });

    it('centers the selected station again when its price tag is clicked again', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { element } = await render([totalStation], {
        selectedStationIdentifier: totalStation.id,
      });
      panTo.mockClear();

      markerButton(element, 'TotalEnergies, 1,859 €').click();

      expect(panTo).toHaveBeenCalledOnce();
    });

    it('centers the selected station again on request', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture } = await render([totalStation], {
        selectedStationIdentifier: totalStation.id,
      });
      panTo.mockClear();

      fixture.componentInstance.revealSelectedStation();

      expect(panTo).toHaveBeenCalledOnce();
    });

    it('keeps the selected station centered when the overlays move', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture } = await render([totalStation], {
        selectedStationIdentifier: totalStation.id,
      });
      panTo.mockClear();

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      expect(panTo).toHaveBeenCalledOnce();
    });

    it('leaves the view alone when the overlays move after the user moved the map', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture } = await render([totalStation], {
        selectedStationIdentifier: totalStation.id,
      });
      const map = panTo.mock.contexts.at(-1) as L.Map;
      panTo.mockClear();

      map.fire('dragstart');
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      expect(panTo).not.toHaveBeenCalled();
    });
  });

  describe('choosing a cluster', () => {
    const coveredByBottomSheet = { top: 0, right: 0, bottom: 400, left: 0 };
    const neighborOf = (station: Station, offsetInDegrees: number): Station => ({
      ...station,
      id: `${station.id}-neighbor`,
      address: {
        ...station.address,
        latitude: station.address.latitude + offsetInDegrees,
      },
    });
    const clusterButton = (element: HTMLElement): HTMLElement => {
      const cluster = element.querySelector<HTMLElement>('.price-cluster-marker');
      if (cluster === null) {
        throw new Error('No cluster on the map');
      }
      return cluster;
    };

    it('zooms the cluster into the part of the map left visible by the overlays', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, element } = await render([totalStation, neighborOf(totalStation, 0.001)]);
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      fitBounds.mockClear();

      clusterButton(element).click();

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({
        // The top keeps room for the price tags standing above their points.
        paddingTopLeft: [24, 64],
        paddingBottomRight: [24, 424],
      });
    });

    it('fans out a cluster that zooming cannot separate and centers it', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const spiderfy = vi.spyOn(L.MarkerCluster.prototype, 'spiderfy');
      const { fixture, element } = await render([totalStation, neighborOf(totalStation, 0)]);
      const map = fitBounds.mock.contexts[0] as L.Map;
      // As if the map were at its maximum zoom already
      vi.spyOn(map, 'getMaxZoom').mockReturnValue(map.getZoom());
      await fixture.whenStable();
      fitBounds.mockClear();

      clusterButton(element).click();

      expect(spiderfy).toHaveBeenCalledOnce();
      expect(panTo).toHaveBeenCalledOnce();
      expect(fitBounds).not.toHaveBeenCalled();
    });
  });

  describe('centerForVisibleArea', () => {
    it('is the point itself without overlays and shifts by half of each overlay', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      await render([totalStation], { selectedStationIdentifier: totalStation.id });
      const map = panTo.mock.contexts.at(-1) as L.Map;
      const point = L.latLng(48.86, 2.34);

      const noOverlay = centerForVisibleArea(map, point, { top: 0, right: 0, bottom: 0, left: 0 });
      const withOverlays = centerForVisibleArea(map, point, {
        top: 40,
        right: 0,
        bottom: 400,
        left: 100,
      });

      expect(offsetFromPanTarget(map, noOverlay, point)).toEqual(L.point(0, 0));
      expect(offsetFromPanTarget(map, withOverlays, point)).toEqual(L.point(50, -180));
    });
  });

  describe('after the user moved the map', () => {
    it('reports the center of the visible map once the user moved it', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      const map = fitBounds.mock.contexts[0] as L.Map;
      const visibleCenters: Coordinates[] = [];
      fixture.componentInstance.visibleCenterChanged.subscribe(center =>
        visibleCenters.push(center)
      );

      map.fire('moveend');
      expect(visibleCenters).toEqual([]);

      map.fire('dragstart');
      map.setView([48.87, 2.33], map.getZoom(), { animate: false });

      expect(visibleCenters.at(-1)?.latitude).toBeCloseTo(48.87, 3);
      expect(visibleCenters.at(-1)?.longitude).toBeCloseTo(2.33, 3);
    });

    it('stays where it is when the search moves to the visible area', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      fitBounds.mockClear();

      fixture.componentRef.setInput('center', {
        latitude: 48.87,
        longitude: 2.33,
        label: 'Kartenmitte',
        source: 'map-area',
      });
      await fixture.whenStable();
      expect(fitBounds).not.toHaveBeenCalled();

      fixture.componentRef.setInput('radiusInKilometers', 10);
      await fixture.whenStable();
      expect(fitBounds).toHaveBeenCalledOnce();
    });
  });

  describe('when the overlays covering the map change', () => {
    const coveredByBottomSheet = { top: 0, right: 0, bottom: 400, left: 0 };

    it('fits the search area into the part of the map that stays visible', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({ paddingBottomRight: [24, 424] });
    });

    it('keeps the view the user moved the map to', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      const map = fitBounds.mock.contexts[0] as L.Map;
      fitBounds.mockClear();

      map.fire('dragstart');
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      expect(fitBounds).not.toHaveBeenCalled();
    });

    it('keeps the view on the selected station', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([totalStation], {
        selectedStationIdentifier: totalStation.id,
      });
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      expect(fitBounds).not.toHaveBeenCalled();
    });
  });
});
