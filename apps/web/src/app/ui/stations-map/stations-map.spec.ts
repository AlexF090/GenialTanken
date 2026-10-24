import { afterNextRender, Component, output, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Station } from '@genialtanken/contracts';
import { DEFAULT_SEARCH_CENTER } from '../../core/search-center/search-center';
import type { Coordinates } from '@genialtanken/contracts';
import type { SearchCenter } from '../../core/search-center/search-center';
import {
  essoStation,
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { accessibleTextOf, renderWithInputs } from '../../../testing/render-page';
import { FakeResizeObserver } from '../../../testing/fake-resize-observer';
import { L } from '../map/leaflet';
import { NO_VIEWPORT_PADDING } from '../map/map-viewport';
import type { ViewportPadding } from '../map/map-viewport';
import { StationsMap } from './stations-map';

interface RenderOptions {
  center?: SearchCenter;
  hasSize?: boolean;
  selectedStationIdentifier?: string;
  cheapestStationIdentifiers?: ReadonlySet<string>;
}

/** Pixel offset of a point from the map center the map pans to, at the current zoom. */
const offsetFromPanTarget = (map: L.Map, target: L.LatLng, point: L.LatLngLiteral): L.Point =>
  map.project(point, map.getZoom()).subtract(map.project(target, map.getZoom())).round();

/** Leaflet keeps no list of its maps; an init hook collects the one the component creates. */
const createdMaps: L.Map[] = [];
L.Map.addInitHook(function (this: L.Map) {
  createdMaps.push(this);
});

const render = async (stations: readonly Station[], options: RenderOptions = {}) => {
  createdMaps.length = 0;
  // jsdom has no layout; Leaflet needs a map size to decide which markers are visible.
  if (options.hasSize ?? true) {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  }
  const { fixture, element } = await renderWithInputs(StationsMap, {
    stations,
    fuelType: 'e5',
    center: options.center ?? DEFAULT_SEARCH_CENTER,
    radiusInKilometers: 5,
    selectedStationIdentifier: options.selectedStationIdentifier,
    cheapestStationIdentifiers: options.cheapestStationIdentifiers,
  });
  const stationSelections: string[] = [];
  fixture.componentInstance.stationSelected.subscribe(stationIdentifier =>
    stationSelections.push(stationIdentifier)
  );
  const visibleCenters: Coordinates[] = [];
  fixture.componentInstance.visibleCenterChanged.subscribe(center => visibleCenters.push(center));
  const [map] = createdMaps;
  if (!(map instanceof L.Map)) {
    throw new Error('The component created no map');
  }
  return { fixture, element, map, stationSelections, visibleCenters };
};

/** The map applies overlay and size changes together, once per animation frame. */
const nextAnimationFrame = (): Promise<void> =>
  new Promise(resolve => {
    requestAnimationFrame(() => {
      resolve();
    });
  });

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
      essoStation,
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

  it.each(['Enter', ' '])('reports the station whose price tag gets %j pressed', async key => {
    const { element, stationSelections } = await render([totalStation]);

    markerButton(element, 'TotalEnergies, 1,859 €').dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true })
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

    expect(element.querySelector('.own-position-dot')?.getAttribute('aria-label')).toBe(
      'Dein Standort'
    );
  });

  it('marks a searched place with a named pin instead of a label covering price tags', async () => {
    const { element } = await render([]);

    expect(element.querySelector('.leaflet-tooltip')).toBeNull();
    expect(element.querySelector('.location-pin')?.getAttribute('aria-label')).toBe(
      'Eiffelturm, Paris'
    );
  });

  it('stacks every price tag above the pin of a searched place', async () => {
    const { element } = await render([totalStation], {
      // South of the tag: Leaflet stacks markers lower on the screen above higher ones.
      center: {
        latitude: totalStation.address.latitude - 0.002,
        longitude: totalStation.address.longitude,
        label: 'Eiffelturm, Paris',
        source: 'place',
      },
    });
    const pin = element.querySelector('.location-pin-marker');
    const priceTag = markerButtons(element)[0]?.closest('.leaflet-marker-icon');
    if (!(pin instanceof HTMLElement) || !(priceTag instanceof HTMLElement)) {
      throw new Error('No marker element');
    }

    expect(Number(priceTag.style.zIndex)).toBeGreaterThan(Number(pin.style.zIndex));
  });

  it('stacks every price tag, selected or not, above the own position', async () => {
    const { element } = await render([totalStation, carrefourStation], {
      // South of both tags: Leaflet stacks markers lower on the screen above higher ones.
      center: {
        latitude:
          Math.min(totalStation.address.latitude, carrefourStation.address.latitude) - 0.002,
        longitude: totalStation.address.longitude,
        label: 'Dein Standort',
        source: 'own-position',
      },
      selectedStationIdentifier: totalStation.id,
    });
    const zIndexOf = (marker: Element | null | undefined): number => {
      if (!(marker instanceof HTMLElement)) {
        throw new Error('No marker element');
      }
      return Number(marker.style.zIndex);
    };
    const ownPosition = zIndexOf(element.querySelector('.own-position-marker'));

    expect(markerButtons(element)).toHaveLength(2);
    for (const priceTag of markerButtons(element)) {
      expect(zIndexOf(priceTag.closest('.leaflet-marker-icon'))).toBeGreaterThan(ownPosition);
    }
  });

  describe('centering a chosen station', () => {
    const coveredByBottomSheet = { top: 0, right: 0, bottom: 400, left: 0 };
    const totalPosition = {
      lat: totalStation.address.latitude,
      lng: totalStation.address.longitude,
    };

    it('centers the price tag in the part of the map left visible by the overlays', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture, map } = await render([totalStation, carrefourStation]);
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();

      fixture.componentRef.setInput('selectedStationIdentifier', totalStation.id);
      await fixture.whenStable();

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

      await nextAnimationFrame();

      expect(panTo).toHaveBeenCalledOnce();
    });

    it('brings a focused price tag out from under the overlays', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture, element, map } = await render([totalStation]);
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();
      // The price tag in the middle of the map, behind the sheet.
      map.setView(totalPosition, map.getZoom(), { animate: false });
      panTo.mockClear();

      markerButton(element, 'TotalEnergies, 1,859 €').focus();

      expect(panTo).toHaveBeenCalledOnce();
      const panTarget = panTo.mock.calls[0]?.[0];
      if (panTarget === undefined) {
        throw new Error('The map did not pan');
      }
      expect(offsetFromPanTarget(map, L.latLng(panTarget), totalPosition)).toEqual(
        L.point(0, -200)
      );
    });

    it('leaves the view alone when a visible price tag is focused', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { element } = await render([totalStation]);
      panTo.mockClear();

      markerButton(element, 'TotalEnergies, 1,859 €').focus();

      expect(panTo).not.toHaveBeenCalled();
    });

    it('leaves the view alone when the overlays move after the user moved the map', async () => {
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const { fixture, map } = await render([totalStation], {
        selectedStationIdentifier: totalStation.id,
      });
      panTo.mockClear();

      map.fire('dragstart');
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();

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
      await nextAnimationFrame();
      fitBounds.mockClear();

      clusterButton(element).click();

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({
        // The top keeps room for the price tags standing above their points.
        paddingTopLeft: [24, 64],
        paddingBottomRight: [24, 424],
      });
    });

    it.each(['Enter', ' '])('zooms the cluster when %j is pressed on it', async key => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, element } = await render([totalStation, neighborOf(totalStation, 0.001)]);
      await fixture.whenStable();
      fitBounds.mockClear();

      const keydown = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true });
      clusterButton(element).dispatchEvent(keydown);

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(keydown.defaultPrevented).toBe(true);
    });

    describe('moving the focus out of the opened cluster', () => {
      const pressEnter = (target: HTMLElement): void => {
        target.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
      };
      const cheaperNeighborOfTotal: Station = {
        ...carrefourStation,
        address: { ...carrefourStation.address, ...totalStation.address, latitude: 48.861 },
      };

      const equallyExpensiveNeighborOfTotal: Station = {
        ...cheaperNeighborOfTotal,
        pricesInEuro: totalStation.pricesInEuro,
      };

      it('focuses the price tag of the cheapest station once the map zoomed in', async () => {
        const { fixture, element } = await render([totalStation, cheaperNeighborOfTotal]);
        const cluster = clusterButton(element);
        cluster.focus();

        pressEnter(cluster);
        await fixture.whenStable();

        await vi.waitFor(() => {
          expect(accessibleTextOf(document.activeElement)).toBe('Carrefour Market, 1,839 €');
        });
      });

      it('focuses the price tag of the cheapest station once the cluster fanned out', async () => {
        const { fixture, element, map } = await render([
          totalStation,
          { ...cheaperNeighborOfTotal, address: { ...totalStation.address } },
        ]);
        vi.spyOn(map, 'getMaxZoom').mockReturnValue(map.getZoom());
        const cluster = clusterButton(element);
        cluster.focus();

        pressEnter(cluster);
        await fixture.whenStable();

        await vi.waitFor(() => {
          expect(accessibleTextOf(document.activeElement)).toBe('Carrefour Market, 1,839 €');
        });
      });

      it('focuses the price tag of the cheapest station of a cluster fanned out already', async () => {
        const { fixture, element, map } = await render([
          totalStation,
          { ...cheaperNeighborOfTotal, address: { ...totalStation.address } },
        ]);
        vi.spyOn(map, 'getMaxZoom').mockReturnValue(map.getZoom());
        const cluster = clusterButton(element);
        cluster.click();
        await vi.waitFor(() => {
          expect(markerNames(element)).toContain('Carrefour Market, 1,839 €');
          expect(element.querySelector('.leaflet-cluster-anim')).toBeNull();
        });
        cluster.focus();

        pressEnter(cluster);
        await fixture.whenStable();

        await vi.waitFor(() => {
          expect(accessibleTextOf(document.activeElement)).toBe('Carrefour Market, 1,839 €');
        });
      });

      it.each([
        ['TotalEnergies, 1,859 €', [totalStation, equallyExpensiveNeighborOfTotal]],
        ['Carrefour Market, 1,859 €', [equallyExpensiveNeighborOfTotal, totalStation]],
      ])('of equally cheap stations focuses the first one shown: %s', async (name, stations) => {
        const { fixture, element } = await render(stations);
        const cluster = clusterButton(element);
        cluster.focus();

        pressEnter(cluster);
        await fixture.whenStable();

        await vi.waitFor(() => {
          expect(accessibleTextOf(document.activeElement)).toBe(name);
        });
      });

      it('leaves the focus alone when the cluster is clicked', async () => {
        const { fixture, element } = await render([totalStation, cheaperNeighborOfTotal]);
        const cluster = clusterButton(element);
        cluster.focus();

        cluster.click();
        await fixture.whenStable();

        // The focus would move once the cluster group ends its zoom animation.
        await vi.waitFor(() => {
          expect(markerNames(element)).toContain('Carrefour Market, 1,839 €');
          expect(element.querySelector('.leaflet-cluster-anim')).toBeNull();
        });
        await nextAnimationFrame();
        expect(markerButtons(element)).not.toContain(document.activeElement);
      });
    });

    it('fans out a cluster that zooming cannot separate and centers it', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const panTo = vi.spyOn(L.Map.prototype, 'panTo');
      const spiderfy = vi.spyOn(L.MarkerCluster.prototype, 'spiderfy');
      const { fixture, element, map } = await render([totalStation, neighborOf(totalStation, 0)]);
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

  describe('after the user moved the map', () => {
    it('reports the center of the visible map once the user moved it', async () => {
      const { map, visibleCenters } = await render([]);

      map.fire('moveend');
      expect(visibleCenters).toEqual([]);

      map.fire('dragstart');
      map.setView([48.87, 2.33], map.getZoom(), { animate: false });

      expect(visibleCenters.at(-1)?.latitude).toBeCloseTo(48.87, 3);
      expect(visibleCenters.at(-1)?.longitude).toBeCloseTo(2.33, 3);
    });

    it('reports the center of the visible map once the user zoomed it', async () => {
      const { element, visibleCenters } = await render([]);

      element.querySelector<HTMLElement>('.leaflet-control-zoom-in')?.click();

      expect(visibleCenters).toHaveLength(1);
    });

    it('tells whether it can zoom further in and out', async () => {
      const { fixture, map } = await render([]);
      expect(fixture.componentInstance.canZoomIn()).toBe(true);
      expect(fixture.componentInstance.canZoomOut()).toBe(true);

      map.setZoom(map.getMaxZoom(), { animate: false });
      expect(fixture.componentInstance.canZoomIn()).toBe(false);
      expect(fixture.componentInstance.canZoomOut()).toBe(true);

      map.setZoom(map.getMinZoom(), { animate: false });
      expect(fixture.componentInstance.canZoomIn()).toBe(true);
      expect(fixture.componentInstance.canZoomOut()).toBe(false);
    });

    it('zooms in and out on request, as a move of the user', async () => {
      const { fixture, map, visibleCenters } = await render([]);
      const initialZoom = map.getZoom();

      fixture.componentInstance.zoomIn();
      await vi.waitFor(() => {
        expect(map.getZoom()).toBe(initialZoom + 1);
      });
      fixture.componentInstance.zoomOut();
      await vi.waitFor(() => {
        expect(map.getZoom()).toBe(initialZoom);
      });

      expect(visibleCenters.length).toBeGreaterThan(0);
    });

    it('reports the center of the visible map once the user moved it with the keyboard', async () => {
      const { element, visibleCenters } = await render([]);
      const container = element.querySelector<HTMLElement>('.stations-map');
      container?.focus();

      container?.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowRight', keyCode: 39, bubbles: true })
      );

      await vi.waitFor(() => {
        expect(visibleCenters).toHaveLength(1);
      });
    });

    it('does not report its own moves to the search area', async () => {
      const { fixture, visibleCenters } = await render([]);

      fixture.componentRef.setInput('viewportPadding', { top: 0, right: 0, bottom: 400, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();
      fixture.componentRef.setInput('radiusInKilometers', 10);
      await fixture.whenStable();

      expect(visibleCenters).toEqual([]);
    });

    it('reports no moves of its own after a search in the visible area', async () => {
      const { fixture, map, visibleCenters } = await render([totalStation, carrefourStation]);
      map.fire('dragstart');
      map.setView([48.87, 2.33], map.getZoom(), { animate: false });
      fixture.componentRef.setInput('center', {
        latitude: 48.87,
        longitude: 2.33,
        label: 'Kartenmitte',
        source: 'map-area',
      });
      await fixture.whenStable();
      visibleCenters.length = 0;
      let moveEndCount = 0;
      map.on('moveend', () => {
        moveEndCount += 1;
      });

      fixture.componentRef.setInput('selectedStationIdentifier', totalStation.id);
      await fixture.whenStable();
      await vi.waitFor(() => {
        expect(moveEndCount).toBeGreaterThan(0);
      });

      expect(visibleCenters).toEqual([]);
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

  describe('when the overlays report their size after the first view', () => {
    const besideSidePanel = { top: 0, right: 0, bottom: 0, left: 400 };

    it('fits the search area again into the part the overlays leave visible, without animation', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      expect(fitBounds.mock.calls.at(-1)?.[1]).toMatchObject({ paddingTopLeft: [24, 24] });
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', besideSidePanel);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({
        paddingTopLeft: [424, 24],
        animate: false,
      });
    });

    it('corrects the first view for an overlay measured right after the map was created', async () => {
      // Like the bottom sheet: measured after the first render, once the map fitted its view.
      @Component({ selector: 'app-measured-overlay', template: '' })
      class MeasuredOverlay {
        readonly measured = output<ViewportPadding>();

        constructor() {
          afterNextRender(() => {
            this.measured.emit(besideSidePanel);
          });
        }
      }
      @Component({
        imports: [StationsMap, MeasuredOverlay],
        template: `<app-stations-map
            [stations]="[]"
            fuelType="e5"
            [center]="center"
            [radiusInKilometers]="5"
            [viewportPadding]="viewportPadding()" />
          <app-measured-overlay (measured)="viewportPadding.set($event)" />`,
      })
      class ExploreLikeHost {
        protected readonly center = DEFAULT_SEARCH_CENTER;
        protected readonly viewportPadding = signal<ViewportPadding>(NO_VIEWPORT_PADDING);
      }
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
      vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');

      const fixture = TestBed.createComponent(ExploreLikeHost);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds.mock.calls.at(-1)?.[1]).toMatchObject({
        paddingTopLeft: [424, 24],
        animate: false,
      });
    });

    it('keeps the view once the user moved the map', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, map } = await render([]);
      map.fire('dragstart');
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', besideSidePanel);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).not.toHaveBeenCalled();
    });

    it('keeps the view the user searched in', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, map } = await render([]);
      map.fire('dragstart');
      fixture.componentRef.setInput('center', {
        latitude: 48.87,
        longitude: 2.33,
        label: 'Kartenmitte',
        source: 'map-area',
      });
      await fixture.whenStable();
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', besideSidePanel);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).not.toHaveBeenCalled();
    });
  });

  describe('when the map changes its size', () => {
    beforeEach(() => {
      vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    const resizeMap = (widthInPixels: number): void => {
      vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(widthInPixels);
      if (FakeResizeObserver.latest === undefined) {
        throw new Error('The map observes no size');
      }
      FakeResizeObserver.latest.resize();
    };

    it('applies a new size and new overlays in the same frame with one fit', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const invalidateSize = vi.spyOn(L.Map.prototype, 'invalidateSize');
      const { fixture } = await render([]);
      fitBounds.mockClear();
      invalidateSize.mockClear();

      resizeMap(1000);
      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 0, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(invalidateSize).toHaveBeenCalledOnce();
      expect(fitBounds).toHaveBeenCalledOnce();
      expect(invalidateSize.mock.invocationCallOrder[0]).toBeLessThan(
        fitBounds.mock.invocationCallOrder[0] ?? 0
      );
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({ paddingTopLeft: [24, 104] });
    });

    it('fits the search area into the resized map', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      await render([]);
      fitBounds.mockClear();

      resizeMap(1000);
      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
    });

    it('keeps the zoom the user chose when the size changes', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { element } = await render([]);
      element.querySelector<HTMLElement>('.leaflet-control-zoom-in')?.click();
      fitBounds.mockClear();

      resizeMap(1000);
      await nextAnimationFrame();

      expect(fitBounds).not.toHaveBeenCalled();
    });

    it('only adapts to the new size after the user moved the map', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const invalidateSize = vi.spyOn(L.Map.prototype, 'invalidateSize');
      const { map } = await render([]);
      fitBounds.mockClear();
      invalidateSize.mockClear();

      map.fire('dragstart');
      resizeMap(1000);
      await nextAnimationFrame();

      expect(invalidateSize).toHaveBeenCalledOnce();
      expect(map.getSize()).toEqual(L.point(1000, 600));
      expect(fitBounds).not.toHaveBeenCalled();
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

      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({ paddingBottomRight: [24, 424] });
    });

    it('fits once when the overlays report their sizes one after the other', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 0, left: 0 });
      await fixture.whenStable();
      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 400, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
      expect(fitBounds.mock.calls[0]?.[1]).toMatchObject({
        paddingTopLeft: [24, 104],
        paddingBottomRight: [24, 424],
      });
    });

    it('leaves the view alone while the overlays cover the whole map', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, map } = await render([]);
      const zoomBefore = map.getZoom();
      fitBounds.mockClear();

      // The fully opened sheet and the search field leave nothing of the 600 px high map.
      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 560, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).not.toHaveBeenCalled();
      expect(map.getZoom()).toBe(zoomBefore);

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();

      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
    });

    it('corrects the first view without an animation and animates later changes', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([]);
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 0, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds.mock.calls.map(call => call[1]?.animate)).toEqual([false, true]);
    });

    it('waits for visible space before fitting a new search area', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, map } = await render([]);
      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 560, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();
      const zoomBefore = map.getZoom();
      fitBounds.mockClear();

      fixture.componentRef.setInput('center', {
        latitude: 48.86,
        longitude: 2.34,
        label: 'Dein Standort',
        source: 'own-position',
      });
      await fixture.whenStable();

      expect(fitBounds).not.toHaveBeenCalled();
      expect(map.getZoom()).toBe(zoomBefore);

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
    });

    it('takes the map out of the focus order while the overlays cover all of it', async () => {
      const { fixture, element } = await render([totalStation]);
      const container = element.querySelector('.stations-map');

      fixture.componentRef.setInput('viewportPadding', { top: 80, right: 0, bottom: 560, left: 0 });
      await fixture.whenStable();
      await nextAnimationFrame();
      await fixture.whenStable();
      expect(container?.hasAttribute('inert')).toBe(true);

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();
      await fixture.whenStable();
      expect(container?.hasAttribute('inert')).toBe(false);
    });

    it('fits the search area while the selected station has no price tag', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture } = await render([totalStation], {
        selectedStationIdentifier: 'fr-not-in-the-results',
      });
      fitBounds.mockClear();

      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();

      expect(fitBounds).toHaveBeenCalledOnce();
    });

    it('keeps the view the user moved the map to', async () => {
      const fitBounds = vi.spyOn(L.Map.prototype, 'fitBounds');
      const { fixture, map } = await render([]);
      fitBounds.mockClear();

      map.fire('dragstart');
      fixture.componentRef.setInput('viewportPadding', coveredByBottomSheet);
      await fixture.whenStable();
      await nextAnimationFrame();

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

      await nextAnimationFrame();

      expect(fitBounds).not.toHaveBeenCalled();
    });
  });

  it('bounds how far a fast swipe flings the map', async () => {
    const { map } = await render([]);

    expect(map.options.inertiaMaxSpeed).toBe(1500);
  });

  describe('teardown', () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it('lets no running zoom animation touch the removed map', async () => {
      const { fixture, map } = await render([totalStation]);
      vi.useFakeTimers();
      // jsdom lacks CSS 3D transforms, so `setZoom` never animates there. Start the animation with
      // the step Leaflet runs one frame after an animated `setZoom`; it schedules the 250 ms
      // fallback timeout that ends the animation.
      if (!('_animateZoom' in map) || typeof map._animateZoom !== 'function') {
        throw new Error('Leaflet no longer has _animateZoom');
      }
      Reflect.apply(map._animateZoom, map, [map.getCenter(), map.getZoom() + 1, true]);

      fixture.destroy();

      expect(() => vi.advanceTimersByTime(250)).not.toThrow();
    });
  });
});
