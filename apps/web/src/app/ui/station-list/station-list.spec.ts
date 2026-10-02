import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { FuelType, Station } from '@genialtanken/contracts';
import { accessibleTextOf, getButton, textOf } from '../../../testing/render-page';
import {
  aralStation,
  carrefourStation,
  totalStation,
  unbrandedStation,
  withoutDistance,
} from '../../../testing/station-fixtures';
import { StationList } from './station-list';

interface RenderOptions {
  stations: readonly Station[];
  fuelType?: FuelType;
  favoriteStationIds?: ReadonlySet<string>;
  cheapestStationIds?: ReadonlySet<string>;
  selectedStationId?: string;
  selectsOnMap?: boolean;
}

const render = async ({
  stations,
  fuelType = 'e5',
  favoriteStationIds = new Set<string>(),
  ...optionalInputs
}: RenderOptions) => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StationList);
  fixture.componentRef.setInput('stations', stations);
  fixture.componentRef.setInput('fuelType', fuelType);
  fixture.componentRef.setInput('favoriteStationIds', favoriteStationIds);
  for (const [name, value] of Object.entries(optionalInputs)) {
    fixture.componentRef.setInput(name, value);
  }
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return {
    fixture,
    element,
    list: element.querySelector('ul[aria-label="Tankstellen"]'),
    items: [...element.querySelectorAll('li')],
  };
};

const linkOf = (item: HTMLElement | undefined): HTMLAnchorElement | null =>
  item?.querySelector('a') ?? null;

describe('StationList', () => {
  it('is a list named "Tankstellen" with one item per station', async () => {
    const { list, items } = await render({ stations: [totalStation, carrefourStation] });

    expect(list?.getAttribute('role')).toBe('list');
    expect(items).toHaveLength(2);
  });

  it('renders title link, address, distance and the German price', async () => {
    const { items } = await render({ stations: [totalStation, carrefourStation] });
    const [totalItem, carrefourItem] = items;

    expect(textOf(linkOf(totalItem))).toBe('TotalEnergies');
    expect(accessibleTextOf(totalItem)).toContain('12 Rue de Rivoli, 75001 Paris');
    expect(accessibleTextOf(totalItem)).toContain('0,85 km');
    expect(accessibleTextOf(totalItem)).toContain('1,859 €');
    expect(accessibleTextOf(carrefourItem)).toContain('1,95 km');
  });

  it('shows the price of the selected fuel type', async () => {
    const { items } = await render({ stations: [carrefourStation], fuelType: 'lpg' });

    expect(accessibleTextOf(items[0])).toContain('0,999 €');
  });

  it('says "kein Preis" when the station has no price for the fuel type', async () => {
    const { items } = await render({ stations: [unbrandedStation], fuelType: 'e10' });

    expect(accessibleTextOf(items[0])).toContain('kein Preis');
  });

  it('uses the street as title when a station has neither brand nor name', async () => {
    const { items } = await render({ stations: [unbrandedStation] });

    expect(textOf(linkOf(items[0]))).toBe('40 Avenue de Flandre');
  });

  it('shows the name below the brand when both exist', async () => {
    const { items } = await render({ stations: [aralStation] });

    expect(textOf(linkOf(items[0]))).toBe('Aral');
    expect(accessibleTextOf(items[0])).toContain('Aral Tankstelle Kassel');
    expect(accessibleTextOf(items[0])).toContain('Wilhelmshöher Allee 100');
  });

  it('omits the distance when it is unknown', async () => {
    const { items } = await render({ stations: [withoutDistance(totalStation)] });

    expect(accessibleTextOf(items[0])).not.toContain('km');
  });

  it('links each station to its URL-encoded detail route', async () => {
    const { items } = await render({
      stations: [totalStation, { ...carrefourStation, id: 'fr/12 34' }],
    });

    expect(linkOf(items[0])?.getAttribute('href')).toBe('/stations/fr-75001001');
    expect(linkOf(items[1])?.getAttribute('href')).toBe('/stations/fr%2F12%2034');
  });

  it('offers a route to each station', async () => {
    const { element } = await render({ stations: [totalStation, carrefourStation] });

    expect(
      [...element.querySelectorAll('select')].map(select => select.getAttribute('aria-label'))
    ).toEqual(['Route zu TotalEnergies', 'Route zu Carrefour Market']);
  });

  it('labels the cheapest stations in words', async () => {
    const { items } = await render({
      stations: [totalStation, unbrandedStation],
      cheapestStationIds: new Set([unbrandedStation.id]),
    });

    expect(accessibleTextOf(items[0])).not.toContain('Günstigster Preis');
    expect(accessibleTextOf(items[1])).toContain('Günstigster Preis');
  });

  it('marks favorites and reports star toggles with the station id', async () => {
    const { fixture, items } = await render({
      stations: [totalStation, carrefourStation],
      favoriteStationIds: new Set([carrefourStation.id]),
    });
    const toggledStationIds: string[] = [];
    fixture.componentInstance.favoriteToggled.subscribe(stationId =>
      toggledStationIds.push(stationId)
    );
    const [totalItem, carrefourItem] = items;
    if (totalItem === undefined || carrefourItem === undefined) {
      throw new Error('Expected two stations');
    }

    expect(getButton(totalItem, 'Favorit: TotalEnergies').getAttribute('aria-pressed')).toBe(
      'false'
    );
    expect(getButton(carrefourItem, 'Favorit: Carrefour Market').getAttribute('aria-pressed')).toBe(
      'true'
    );

    getButton(totalItem, 'Favorit: TotalEnergies').click();

    expect(toggledStationIds).toEqual(['fr-75001001']);
  });

  it('links titles to the details and offers no map selection unless asked to', async () => {
    const { element, items } = await render({ stations: [totalStation] });

    expect(linkOf(items[0])?.getAttribute('href')).toBe('/stations/fr-75001001');
    expect(element.querySelector('a[aria-label^="Details:"]')).toBeNull();
  });

  it('selects a station with its row and opens the details with a separate link', async () => {
    const { fixture, element } = await render({
      stations: [totalStation, carrefourStation],
      selectsOnMap: true,
      selectedStationId: carrefourStation.id,
    });
    const selectedStationIds: string[] = [];
    fixture.componentInstance.stationSelected.subscribe(stationId =>
      selectedStationIds.push(stationId)
    );
    const totalButton = getButton(element, 'TotalEnergies');
    const carrefourButton = getButton(element, 'Carrefour Market');

    expect(totalButton.getAttribute('aria-pressed')).toBe('false');
    expect(carrefourButton.getAttribute('aria-pressed')).toBe('true');
    expect(
      element.querySelector('a[aria-label="Details: TotalEnergies"]')?.getAttribute('href')
    ).toBe('/stations/fr-75001001');

    totalButton.click();

    expect(selectedStationIds).toEqual(['fr-75001001']);
  });

  it('scrolls the selected station into view', async () => {
    const { fixture, items } = await render({ stations: [totalStation, carrefourStation] });
    const scrollIntoView = vi.fn();
    for (const item of items) {
      item.scrollIntoView = scrollIntoView;
    }

    fixture.componentRef.setInput('selectedStationId', carrefourStation.id);
    await fixture.whenStable();

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(scrollIntoView.mock.contexts[0]).toBe(items[1]);
  });
});
