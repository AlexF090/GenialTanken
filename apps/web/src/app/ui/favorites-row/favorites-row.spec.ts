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

const render = (stations: Station[]) =>
  renderWithInputs(FavoritesRow, { stations, fuelType: 'e5' }, [provideRouter([])]);

describe('FavoritesRow', () => {
  it('renders nothing without favorites', async () => {
    const { element } = await render([]);

    expect(element.children).toHaveLength(0);
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
