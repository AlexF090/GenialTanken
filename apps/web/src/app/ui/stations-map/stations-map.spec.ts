import { TestBed } from '@angular/core/testing';
import type { Station } from '@genialtanken/contracts';
import { DEFAULT_SEARCH_CENTER } from '../../core/search-center/search-center';
import type { SearchCenter } from '../../core/search-center/search-center';
import {
  carrefourStation,
  totalStation,
  unbrandedStation,
} from '../../../testing/station-fixtures';
import { accessibleTextOf, textOf } from '../../../testing/render-page';
import { StationsMap } from './stations-map';

interface RenderOptions {
  center?: SearchCenter;
  hasSize?: boolean;
  selectedStationId?: string;
  cheapestStationIds?: ReadonlySet<string>;
}

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
  fixture.componentRef.setInput('selectedStationId', options.selectedStationId);
  if (options.cheapestStationIds !== undefined) {
    fixture.componentRef.setInput('cheapestStationIds', options.cheapestStationIds);
  }
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const stationSelections: string[] = [];
  fixture.componentInstance.stationSelected.subscribe(stationId =>
    stationSelections.push(stationId)
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
      cheapestStationIds: new Set([unbrandedStation.id]),
    });

    expect(markerNames(element).sort()).toEqual([
      '40 Avenue de Flandre, 1,799 €, günstigster Preis',
      'Carrefour Market, 1,839 €',
      'TotalEnergies, 1,859 €',
    ]);
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
      selectedStationId: totalStation.id,
    });
    const pressedNames = (): string[] =>
      markerButtons(element)
        .filter(button => button.getAttribute('aria-pressed') === 'true')
        .map(button => accessibleTextOf(button));

    expect(pressedNames()).toEqual(['TotalEnergies, 1,859 €']);

    fixture.componentRef.setInput('selectedStationId', carrefourStation.id);
    await fixture.whenStable();

    expect(pressedNames()).toEqual(['Carrefour Market, 1,839 €']);
  });

  it('keeps working when the stations change while a selected station is being revealed', async () => {
    // Without a size no price tag is in view, so revealing the selection has to move the map.
    const { fixture, element } = await render([totalStation, carrefourStation], {
      hasSize: false,
    });

    fixture.componentRef.setInput('selectedStationId', carrefourStation.id);
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
});
