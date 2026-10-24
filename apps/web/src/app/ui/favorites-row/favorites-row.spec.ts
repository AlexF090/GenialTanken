import type { Station } from '@genialtanken/contracts';
import { provideRouter } from '@angular/router';
import { accessibleTextOf, renderWithInputs, textOf } from '../../../testing/render-page';
import {
  carrefourStation,
  totalStation,
  withDistance,
  withPrices,
} from '../../../testing/station-fixtures';
import { FavoritesRow } from './favorites-row';

const render = (stations: Station[], isLoading = false, favoriteCount = stations.length) =>
  renderWithInputs(FavoritesRow, { stations, fuelType: 'e5', isLoading, favoriteCount }, [
    provideRouter([]),
  ]);

describe('FavoritesRow', () => {
  it('renders nothing without favorites', async () => {
    const { element } = await render([]);

    expect(element.children).toHaveLength(0);
  });

  it('holds the place of favorites loading for the first time, named as text', async () => {
    const { element } = await render([], true, 2);

    const section = element.querySelector('section');
    expect(textOf(section?.querySelector('h2'))).toBe('Favoriten');
    expect(element.querySelector('app-skeleton-rows')?.getAttribute('aria-hidden')).toBe('true');
    expect(accessibleTextOf(section)).toContain('Favoriten werden geladen …');
    expect(section?.querySelector('[role="status"], [aria-live]')).toBeNull();
  });

  it('holds the place of one card for a single favorite', async () => {
    const { element } = await render([], true, 1);

    expect(element.querySelectorAll('.skeleton-rows__card')).toHaveLength(1);
  });

  it('holds the place of at most two cards, as many as the row shows at once', async () => {
    const { element } = await render([], true, 5);

    expect(element.querySelectorAll('.skeleton-rows__card')).toHaveLength(2);
  });

  it('keeps the shown favorites while they load again', async () => {
    const { element } = await render([totalStation], true);

    expect(element.querySelector('app-skeleton-rows')).toBeNull();
    expect(element.querySelectorAll('li a')).toHaveLength(1);
    expect(textOf(element)).not.toContain('geladen');
  });

  it('is a section named "Favoriten" that links to all favorites', async () => {
    const { element } = await render([totalStation]);

    const section = element.querySelector('section');
    const heading = section?.querySelector('h2');
    expect(textOf(heading)).toBe('Favoriten');
    expect(section?.getAttribute('aria-labelledby')).toBe(heading?.id);
    const allLink = element.querySelector('a[aria-label="Alle Favoriten"]');
    expect(textOf(allLink)).toBe('Alle');
    expect(allLink?.getAttribute('href')).toBe('/favorites');
  });

  it('shows each favorite with its price and distance and links to its card', async () => {
    const { element } = await render([
      withDistance(withPrices(totalStation, { e5: 1.859 }), 950),
      withDistance(withPrices(carrefourStation, { e5: null }), null),
    ]);

    const cards = [...element.querySelectorAll('li a')];
    expect(cards.map(card => card.getAttribute('href'))).toEqual([
      `/stations/${totalStation.id}`,
      `/stations/${carrefourStation.id}`,
    ]);
    expect(accessibleTextOf(cards[0])).toBe('TotalEnergies 1,859 € 0,95 km');
    expect(accessibleTextOf(cards[1])).toBe('Carrefour Market kein Preis');
  });

  it('moves the focus to "Alle" on request, if shown', async () => {
    const { fixture } = await render([totalStation]);

    expect(fixture.componentInstance.focusAllLink()).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Alle Favoriten');

    fixture.componentRef.setInput('stations', []);
    await fixture.whenStable();

    expect(fixture.componentInstance.focusAllLink()).toBe(false);
  });
});
