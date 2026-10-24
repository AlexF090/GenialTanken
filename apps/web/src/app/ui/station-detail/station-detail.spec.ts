import type { FuelType, Station } from '@genialtanken/contracts';
import {
  accessibleTextOf,
  getButton,
  renderWithInputs,
  textOf,
} from '../../../testing/render-page';
import {
  essoStation,
  totalStation,
  unbrandedStation,
  withoutDistance,
} from '../../../testing/station-fixtures';
import { OPEN_EXTERNAL_URL } from '../../core/navigation-apps/open-external-url';
import { StationDetail } from './station-detail';

interface RenderOptions {
  station: Station;
  fuelType?: FuelType;
  isFavorite?: boolean;
  canShare?: boolean;
}

const render = async ({
  station,
  fuelType = 'e5',
  isFavorite = false,
  canShare = false,
}: RenderOptions) => {
  const { fixture, element } = await renderWithInputs(
    StationDetail,
    {
      station: withoutDistance(station),
      fuelType,
      isFavorite,
      canShare,
      today: new Date('2026-10-05T12:00:00'),
    },
    [{ provide: OPEN_EXTERNAL_URL, useValue: () => undefined }]
  );
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
    const { article, element } = await render({ station: essoStation });

    expect(textOf(article?.querySelector('h2'))).toBe('Esso');
    expect(textOf(article?.querySelector('.station-detail__subtitle'))).toBe(
      'Relais Esso Part-Dieu'
    );
    expect(textOf(regionNamed(element, 'Adresse').querySelector('address'))).toBe(
      'Boulevard Vivier-Merle 19 69003 Lyon'
    );
  });

  it('names the city below a station titled by its street, and the full address', async () => {
    const { article } = await render({ station: unbrandedStation });

    expect(textOf(article?.querySelector('h2'))).toBe('40 Avenue de Flandre');
    expect(textOf(article?.querySelector('.station-detail__subtitle'))).toBe('75019 Paris');
    expect(textOf(article?.querySelector('address'))).toBe('40 Avenue de Flandre 75019 Paris');
  });

  it('offers route and favorite as actions, sharing only where possible', async () => {
    const { element } = await render({ station: totalStation });
    const actions = element.querySelector('.station-detail__actions');

    expect(actions?.querySelector('select')?.getAttribute('aria-label')).toBe(
      'Route zu TotalEnergies'
    );
    expect(getButton(element, 'Favorit: TotalEnergies')).toBeTruthy();
    expect(
      [...(actions?.querySelectorAll('.action-tile__label') ?? [])].map(label => textOf(label))
    ).toEqual(['Route', 'Favorit']);
  });

  it('reports share requests from its share button', async () => {
    const { fixture, element } = await render({ station: totalStation, canShare: true });
    const shareRequested = vi.fn();
    fixture.componentInstance.shareRequested.subscribe(shareRequested);

    getButton(element, 'Teilen').click();

    expect(shareRequested).toHaveBeenCalledOnce();
  });

  it('credits the French price data below the address', async () => {
    const { element } = await render({ station: totalStation });

    expect(textOf(regionNamed(element, 'Adresse'))).toContain(
      'Preisdaten: prix-carburants.gouv.fr'
    );
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
    const { element } = await render({ station: essoStation });
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
