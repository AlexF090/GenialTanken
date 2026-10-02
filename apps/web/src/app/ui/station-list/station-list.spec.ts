import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import type { FuelType, Station } from '@genialtanken/contracts';
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
}

const render = async ({
  stations,
  fuelType = 'e5',
  favoriteStationIds = new Set<string>(),
}: RenderOptions) => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(StationList);
  fixture.componentRef.setInput('stations', stations);
  fixture.componentRef.setInput('fuelType', fuelType);
  fixture.componentRef.setInput('favoriteStationIds', favoriteStationIds);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, items: [...element.querySelectorAll('li')] };
};

const titleOf = (item: HTMLElement | undefined): string | null | undefined =>
  item?.querySelector('.station-card__title')?.textContent;

describe('StationList', () => {
  it('renders brand, address, German price and correctly rounded distance', async () => {
    const { items } = await render({ stations: [totalStation, carrefourStation] });

    expect(items).toHaveLength(2);
    const [totalItem, carrefourItem] = items;
    expect(titleOf(totalItem)).toBe('TotalEnergies');
    expect(totalItem?.textContent).toContain('12 Rue de Rivoli');
    expect(totalItem?.textContent).toContain('75001 Paris');
    expect(totalItem?.textContent).toContain('1,859 €');
    expect(totalItem?.textContent).toContain('0,85 km');
    expect(carrefourItem?.textContent).toContain('1,95 km');
  });

  it('shows the price of the selected fuel type', async () => {
    const { items } = await render({ stations: [carrefourStation], fuelType: 'lpg' });

    expect(items[0]?.textContent).toContain('0,999 €');
  });

  it('uses the street as title when a station has neither brand nor name', async () => {
    const { items } = await render({ stations: [unbrandedStation] });

    expect(titleOf(items[0])).toBe('40 Avenue de Flandre');
  });

  it('shows the name below the brand when both exist', async () => {
    const { items } = await render({ stations: [aralStation] });

    expect(titleOf(items[0])).toBe('Aral');
    expect(items[0]?.querySelector('.station-card__subtitle')?.textContent).toBe(
      'Aral Tankstelle Kassel'
    );
    expect(items[0]?.textContent).toContain('Wilhelmshöher Allee 100');
  });

  it('omits the distance when it is unknown', async () => {
    const { items } = await render({ stations: [withoutDistance(totalStation)] });

    expect(items[0]?.textContent).not.toContain('km');
  });

  it('links each station to its URL-encoded detail route', async () => {
    const { items } = await render({
      stations: [totalStation, { ...carrefourStation, id: 'fr/12 34' }],
    });

    expect(items[0]?.querySelector('a')?.getAttribute('href')).toBe('/stations/fr-75001001');
    expect(items[1]?.querySelector('a')?.getAttribute('href')).toBe('/stations/fr%2F12%2034');
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

    const totalStar = items[0]?.querySelector('button');
    const carrefourStar = items[1]?.querySelector('button');
    expect(totalStar?.getAttribute('aria-pressed')).toBe('false');
    expect(carrefourStar?.getAttribute('aria-pressed')).toBe('true');
    expect(carrefourStar?.getAttribute('aria-label')).toBe('Favorit: Carrefour Market');

    totalStar?.click();

    expect(toggledStationIds).toEqual(['fr-75001001']);
  });
});
