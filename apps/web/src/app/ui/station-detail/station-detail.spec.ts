import { TestBed } from '@angular/core/testing';
import type { FuelType, Station } from '@genialtanken/contracts';
import { accessibleTextOf, getButton, textOf } from '../../../testing/render-page';
import { aralStation, totalStation, withoutDistance } from '../../../testing/station-fixtures';
import { StationDetail } from './station-detail';

interface RenderOptions {
  station: Station;
  fuelType?: FuelType;
  isFavorite?: boolean;
}

const render = async ({ station, fuelType = 'e5', isFavorite = false }: RenderOptions) => {
  const fixture = TestBed.createComponent(StationDetail);
  fixture.componentRef.setInput('station', withoutDistance(station));
  fixture.componentRef.setInput('fuelType', fuelType);
  fixture.componentRef.setInput('isFavorite', isFavorite);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  return { fixture, element, article: element.querySelector('article') };
};

const regionNamed = (element: HTMLElement, name: string): HTMLElement => {
  const region = [...element.querySelectorAll<HTMLElement>('section[aria-labelledby]')].find(
    section => {
      const headingIdentifier = section.getAttribute('aria-labelledby') ?? '';
      return textOf(element.querySelector(`#${headingIdentifier}`)) === name;
    }
  );
  if (region === undefined) {
    throw new Error(`No region named "${name}" found`);
  }
  return region;
};

const priceRows = (element: HTMLElement): HTMLElement[] => [
  ...regionNamed(element, 'Preise').querySelectorAll<HTMLElement>('li'),
];

describe('StationDetail', () => {
  beforeEach(() => {
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(400);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(160);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('is an article with title, name and address', async () => {
    const { article } = await render({ station: aralStation });

    expect(textOf(article?.querySelector('h2'))).toBe('Aral');
    expect(article?.textContent).toContain('Aral Tankstelle Kassel');
    expect(textOf(article?.querySelector('address'))).toBe('Wilhelmshöher Allee 100 34119 Kassel');
  });

  it('lists all six fuels with the selected fuel first and marked', async () => {
    const { element } = await render({ station: totalStation, fuelType: 'diesel' });

    expect(priceRows(element).map(row => accessibleTextOf(row))).toEqual([
      'Diesel Dein Kraftstoff 1,689 €',
      'Super E5 1,859 €',
      'Super E10 1,799 €',
      'Super Plus 1,929 €',
      'E85 kein Preis',
      'LPG kein Preis',
    ]);
  });

  it('shows the selected fuel as hero price and the others as list prices', async () => {
    const { element } = await render({ station: totalStation, fuelType: 'e10' });
    const [selectedRow, ...otherRows] = priceRows(element);

    expect(selectedRow?.querySelector('app-price')?.classList).toContain('price--hero');
    for (const row of otherRows) {
      expect(row.querySelector('app-price')?.classList).toContain('price--list');
    }
  });

  it('says "kein Preis" when the selected fuel has no price', async () => {
    const { element } = await render({ station: totalStation, fuelType: 'lpg' });

    expect(accessibleTextOf(priceRows(element)[0])).toBe('LPG Dein Kraftstoff kein Preis');
  });

  it('shows the open status next to the opening times', async () => {
    const { element } = await render({ station: aralStation });
    const openingTimes = regionNamed(element, 'Öffnungszeiten');

    expect(openingTimes.textContent).toContain('Die Tankstelle hat leider geschlossen.');
    expect(openingTimes.querySelectorAll('li')).toHaveLength(8);
  });

  it('claims no open status when the data source has none', async () => {
    const { element } = await render({ station: totalStation });
    const openingTimes = regionNamed(element, 'Öffnungszeiten');

    expect(openingTimes.textContent).not.toContain('Die Tankstelle ist geöffnet.');
    expect(openingTimes.textContent).not.toContain('Die Tankstelle hat leider geschlossen.');
  });

  it('reports favorite toggles', async () => {
    const { fixture, element } = await render({ station: totalStation, isFavorite: true });
    const toggled = vi.fn();
    fixture.componentInstance.favoriteToggled.subscribe(toggled);
    const button = getButton(element, 'Favorit: TotalEnergies');

    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();

    expect(toggled).toHaveBeenCalledOnce();
  });
});
