import { TestBed } from '@angular/core/testing';
import type { Station } from '@genialtanken/contracts';
import {
  carrefourStation,
  PARIS,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { StationsMap } from './stations-map';

const render = async (stations: readonly Station[]) => {
  // jsdom has no layout; Leaflet needs a map size to decide which markers are visible.
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(600);
  const fixture = TestBed.createComponent(StationsMap);
  fixture.componentRef.setInput('stations', stations);
  fixture.componentRef.setInput('fuelType', 'e5');
  fixture.componentRef.setInput('ownPosition', PARIS);
  await fixture.whenStable();
  return { fixture, element: fixture.nativeElement as HTMLElement };
};

const markerNames = (element: HTMLElement): (string | null)[] =>
  [...element.querySelectorAll('img.leaflet-marker-icon')].map(marker =>
    marker.getAttribute('alt')
  );

describe('StationsMap', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is a labelled region', async () => {
    const { element } = await render([]);

    expect(element.querySelector('[role="region"]')?.getAttribute('aria-label')).toBe(
      'Karte der Tankstellen in deiner Nähe'
    );
  });

  it('renders a named marker with the selected fuel price for every station', async () => {
    const { element } = await render([totalStation, carrefourStation, unbrandedStation]);

    expect(markerNames(element).sort()).toEqual([
      '40 Avenue de Flandre, 1,799 €',
      'Carrefour Market, 1,839 €',
      'TotalEnergies, 1,859 €',
    ]);
  });

  it('marks the own position', async () => {
    const { element } = await render([]);

    expect(element.querySelector('.own-position-marker')?.getAttribute('title')).toBe(
      'Dein Standort'
    );
    expect(element.querySelector('.leaflet-tooltip')?.textContent).toBe('Du bist hier!');
  });

  it('replaces the markers when the stations change', async () => {
    const { fixture, element } = await render([totalStation, carrefourStation]);

    fixture.componentRef.setInput('stations', [unbrandedStation]);
    await fixture.whenStable();

    expect(markerNames(element)).toEqual(['40 Avenue de Flandre, 1,799 €']);
  });

  it('opens a popup with the price and reports the station chosen via "Mehr Anzeigen"', async () => {
    const { fixture, element } = await render([totalStation]);
    const selectedStationIds: string[] = [];
    fixture.componentInstance.stationSelected.subscribe(stationId =>
      selectedStationIds.push(stationId)
    );

    element.querySelector<HTMLElement>('img.leaflet-marker-icon')?.click();
    const popup = element.querySelector('.leaflet-popup');
    const link = popup?.querySelector('a.station-marker-popup__link');
    expect(popup?.textContent).toContain('1,859 €');
    expect(link?.getAttribute('href')).toBe('/stations/fr-75001001');

    link?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));

    expect(selectedStationIds).toEqual(['fr-75001001']);
  });
});
