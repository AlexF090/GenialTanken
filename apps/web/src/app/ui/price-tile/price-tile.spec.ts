import { accessibleTextOf, renderWithInputs, textOf } from '../../../testing/render-page';
import { PriceTile } from './price-tile';
import type { PriceTint } from './price-tile';

const render = async (
  priceInEuro: number | null,
  tint: PriceTint,
  isCheapest?: boolean
): Promise<HTMLElement> =>
  (await renderWithInputs(PriceTile, { priceInEuro, tint, isCheapest })).element;

describe('PriceTile', () => {
  it.each<PriceTint>(['low', 'medium', 'high', 'cheapest', 'without-price'])(
    'is tinted %s',
    async tint => {
      const element = await render(1.859, tint);

      expect([...element.classList].filter(name => name.startsWith('price-tile--'))).toEqual([
        `price-tile--${tint}`,
      ]);
    }
  );

  it('shows the price', async () => {
    expect(accessibleTextOf(await render(1.859, 'medium'))).toBe('1,859 €');
  });

  it('names the cheapest price in words and shows a short label', async () => {
    const element = await render(1.7, 'cheapest', true);

    expect(accessibleTextOf(element)).toContain('Günstigster Preis');
    expect(textOf(element.querySelector('[aria-hidden="true"].price-tile__cheapest-label'))).toBe(
      'günstigst'
    );
  });

  it('has no cheapest label for other prices', async () => {
    const element = await render(1.8, 'medium');

    expect(accessibleTextOf(element)).not.toContain('Günstigster Preis');
    expect(element.querySelector('.price-tile__cheapest-label')).toBeNull();
  });
});
