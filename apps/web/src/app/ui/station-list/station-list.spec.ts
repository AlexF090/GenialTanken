import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter } from '@angular/router';
import type { FuelType, Station } from '@genialtanken/contracts';
import {
  accessibleTextOf,
  getButton,
  hostElementOf,
  renderWithInputs,
  textOf,
} from '../../../testing/render-page';
import {
  essoStation,
  carrefourStation,
  totalStation,
  unbrandedStation,
  withoutDistance,
  withPrices,
} from '../../../testing/station-fixtures';
import { StationList } from './station-list';

interface RenderOptions {
  stations: readonly Station[];
  fuelType?: FuelType;
  favoriteStationIdentifiers?: ReadonlySet<string>;
  cheapestStationIdentifiers?: ReadonlySet<string>;
  selectedStationIdentifier?: string;
  selectsOnMap?: boolean;
}

const render = async ({
  stations,
  fuelType = 'e5',
  favoriteStationIdentifiers = new Set<string>(),
  ...optionalInputs
}: RenderOptions) => {
  const { fixture, element } = await renderWithInputs(
    StationList,
    { stations, fuelType, favoriteStationIdentifiers, ...optionalInputs },
    [provideRouter([])]
  );
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

  it('shows only the brand above the address, not the station name too', async () => {
    const { items } = await render({ stations: [essoStation] });

    expect(textOf(linkOf(items[0]))).toBe('Esso');
    expect(accessibleTextOf(items[0])).not.toContain('Relais Esso Part-Dieu');
    expect(accessibleTextOf(items[0])).toContain('Boulevard Vivier-Merle 19');
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

  it('leaves the route to the card of the station', async () => {
    const { element } = await render({ stations: [totalStation, carrefourStation] });

    expect(element.querySelector('select')).toBeNull();
  });

  it('puts the distance before the address in the secondary line', async () => {
    const { items } = await render({ stations: [totalStation] });

    expect(textOf(items[0]?.querySelector('.station-row__secondary'))).toBe(
      '0,85 km, · 12 Rue de Rivoli, 75001 Paris'
    );
    expect(accessibleTextOf(items[0]?.querySelector('.station-row__secondary'))).toBe(
      '0,85 km, 12 Rue de Rivoli, 75001 Paris'
    );
  });

  it('tints the price tiles by their level, the cheapest solid green', async () => {
    const { items } = await render({
      stations: [
        withPrices(totalStation, { e5: 1.7 }),
        withPrices(carrefourStation, { e5: 1.8 }),
        withPrices(essoStation, { e5: 1.9 }),
        withPrices(unbrandedStation, { e5: null }),
      ],
      cheapestStationIdentifiers: new Set([totalStation.id]),
    });

    expect(
      items.map(item =>
        [...(item.querySelector('.station-row__price')?.classList ?? [])].filter(name =>
          name.startsWith('price-tile--')
        )
      )
    ).toEqual([
      ['price-tile--cheapest'],
      ['price-tile--medium'],
      ['price-tile--high'],
      ['price-tile--without-price'],
    ]);
  });

  it('labels the cheapest stations in words', async () => {
    const { items } = await render({
      stations: [totalStation, unbrandedStation],
      cheapestStationIdentifiers: new Set([unbrandedStation.id]),
    });

    expect(accessibleTextOf(items[0])).not.toContain('Günstigster Preis');
    expect(accessibleTextOf(items[1])).toContain('Günstigster Preis');
    expect(textOf(items[1]?.querySelector('[aria-hidden="true"].price-tile__cheapest-label'))).toBe(
      'günstigst'
    );
  });

  it('marks favorites and reports star toggles with the station id', async () => {
    const { fixture, items } = await render({
      stations: [totalStation, carrefourStation],
      favoriteStationIdentifiers: new Set([carrefourStation.id]),
    });
    const toggledStationIdentifiers: string[] = [];
    fixture.componentInstance.favoriteToggled.subscribe(stationIdentifier =>
      toggledStationIdentifiers.push(stationIdentifier)
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

    expect(toggledStationIdentifiers).toEqual(['fr-75001001']);
  });

  it('links titles to the details and offers no map selection unless asked to', async () => {
    const { element, items } = await render({ stations: [totalStation] });

    expect(linkOf(items[0])?.getAttribute('href')).toBe('/stations/fr-75001001');
    expect(element.querySelector('a[aria-label^="Details:"]')).toBeNull();
  });

  it('offers the favorite star and the details as the only link in a selecting row', async () => {
    const { items } = await render({ stations: [totalStation], selectsOnMap: true });
    const row = items[0];
    if (row === undefined) {
      throw new Error('Expected one station');
    }

    expect([...row.querySelectorAll('a')].map(link => link.getAttribute('aria-label'))).toEqual([
      'Details: TotalEnergies',
    ]);
    expect(getButton(row, 'Favorit: TotalEnergies')).toBeTruthy();
  });

  it('selects a station with its row and opens the details with a separate link', async () => {
    const { fixture, element } = await render({
      stations: [totalStation, carrefourStation],
      selectsOnMap: true,
      selectedStationIdentifier: carrefourStation.id,
    });
    const selectedStationIdentifiers: string[] = [];
    fixture.componentInstance.stationSelected.subscribe(stationIdentifier =>
      selectedStationIdentifiers.push(stationIdentifier)
    );
    const totalButton = getButton(element, 'TotalEnergies');
    const carrefourButton = getButton(element, 'Carrefour Market');

    // Selecting is not a toggle: the selected row is the current one, like a selected list cell.
    expect(totalButton.hasAttribute('aria-pressed')).toBe(false);
    expect(totalButton.hasAttribute('aria-current')).toBe(false);
    expect(carrefourButton.getAttribute('aria-current')).toBe('true');
    expect(
      element.querySelector('a[aria-label="Details: TotalEnergies"]')?.getAttribute('href')
    ).toBe('/stations/fr-75001001');

    totalButton.click();

    expect(selectedStationIdentifiers).toEqual(['fr-75001001']);
  });

  it('scrolls the selected station into view', async () => {
    const { fixture, items } = await render({ stations: [totalStation, carrefourStation] });
    const scrollIntoView = vi.fn();
    for (const item of items) {
      item.scrollIntoView = scrollIntoView;
    }

    fixture.componentRef.setInput('selectedStationIdentifier', carrefourStation.id);
    await fixture.whenStable();

    expect(scrollIntoView).toHaveBeenCalledExactlyOnceWith({ block: 'nearest' });
    expect(scrollIntoView.mock.contexts[0]).toBe(items[1]);
  });

  it.each([true, false])(
    'focuses the title of a station without scrolling (selects on map: %s)',
    async selectsOnMap => {
      const { fixture, items } = await render({
        stations: [totalStation, carrefourStation],
        selectsOnMap,
      });
      const title = items[1]?.querySelector<HTMLElement>('.station-row__title');
      const focus = vi.spyOn(title ?? HTMLElement.prototype, 'focus');

      const isFocused = fixture.componentInstance.focusStation(carrefourStation.id);

      expect(isFocused).toBe(true);
      expect(focus).toHaveBeenCalledExactlyOnceWith({ preventScroll: true });
      expect(document.activeElement).toBe(title);
    }
  );

  it('leaves the focus alone for a station it does not list', async () => {
    const { fixture } = await render({ stations: [totalStation] });
    const previouslyFocused = document.activeElement;

    const isFocused = fixture.componentInstance.focusStation(carrefourStation.id);

    expect(isFocused).toBe(false);
    expect(document.activeElement).toBe(previouslyFocused);
  });

  it('focuses the star of a station', async () => {
    const { fixture } = await render({ stations: [totalStation, carrefourStation] });

    const isFocused = fixture.componentInstance.focusFavoriteButton(carrefourStation.id);

    expect(isFocused).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Favorit: Carrefour Market');
  });

  it('leaves the focus alone when asked for the star of a station it does not list', async () => {
    const { fixture } = await render({ stations: [totalStation] });
    const previouslyFocused = document.activeElement;

    const isFocused = fixture.componentInstance.focusFavoriteButton(carrefourStation.id);

    expect(isFocused).toBe(false);
    expect(document.activeElement).toBe(previouslyFocused);
  });

  describe('with content inserted after a row', () => {
    @Component({
      imports: [StationList],
      changeDetection: ChangeDetectionStrategy.OnPush,
      template: `
        <app-station-list
          fuelType="e5"
          [stations]="stations()"
          [favoriteStationIdentifiers]="favoriteStationIdentifiers"
          [insertionAfterRow]="3">
          <aside stationListInsertion aria-label="Hinweis">Tipp</aside>
        </app-station-list>
      `,
    })
    class InsertingHost {
      readonly stations = input.required<readonly Station[]>();
      readonly favoriteStationIdentifiers: ReadonlySet<string> = new Set();
    }

    const fiveStations: readonly Station[] = [
      totalStation,
      carrefourStation,
      unbrandedStation,
      essoStation,
      { ...totalStation, id: 'fr-75000005' },
    ];

    const renderInserting = async (stations: readonly Station[]) => {
      TestBed.configureTestingModule({ providers: [provideRouter([])] });
      const fixture = TestBed.createComponent(InsertingHost);
      fixture.componentRef.setInput('stations', stations);
      await fixture.whenStable();
      const element = hostElementOf(fixture);
      return {
        fixture,
        element,
        stationList: fixture.debugElement
          .query(By.directive(StationList))
          .injector.get(StationList),
        lists: [...element.querySelectorAll('ul')],
        insertion: element.querySelector('aside'),
      };
    };

    it('ends the list after the row and continues it after the content, with every row counted', async () => {
      const { lists, insertion } = await renderInserting(fiveStations);

      expect(lists.map(list => list.getAttribute('aria-label'))).toEqual([
        'Tankstellen',
        'Weitere Tankstellen',
      ]);
      expect(lists[0]?.querySelectorAll('li')).toHaveLength(3);
      expect(lists[1]?.querySelectorAll('li')).toHaveLength(2);
      expect(lists[0]?.nextElementSibling).toBe(insertion);
      expect(insertion?.nextElementSibling).toBe(lists[1]);
      const items = lists.flatMap(list => [...list.querySelectorAll('li')]);
      expect(items.map(item => item.getAttribute('aria-posinset'))).toEqual([
        '1',
        '2',
        '3',
        '4',
        '5',
      ]);
      expect(new Set(items.map(item => item.getAttribute('aria-setsize')))).toEqual(new Set(['5']));
    });

    it('puts the content after the list when it has no more rows than that', async () => {
      const { lists, insertion } = await renderInserting(fiveStations.slice(0, 3));

      expect(lists).toHaveLength(1);
      expect(lists[0]?.querySelectorAll('li')).toHaveLength(3);
      expect(lists[0]?.nextElementSibling).toBe(insertion);
      expect(lists[0]?.querySelector('li')?.hasAttribute('aria-posinset')).toBe(false);
    });

    it('focuses a station after the content', async () => {
      const { element, stationList } = await renderInserting(fiveStations);
      document.body.append(element);

      expect(stationList.focusStation(essoStation.id)).toBe(true);
      expect(document.activeElement?.closest('ul')?.getAttribute('aria-label')).toBe(
        'Weitere Tankstellen'
      );
      document.body.replaceChildren();
    });
  });
});
