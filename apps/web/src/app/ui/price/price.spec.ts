import { TestBed } from '@angular/core/testing';
import { accessibleTextOf } from '../../../testing/render-page';
import { Price } from './price';
import type { PriceSize } from './price';

const render = async (priceInEuro: number | null, size?: PriceSize): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(Price);
  fixture.componentRef.setInput('priceInEuro', priceInEuro);
  if (size !== undefined) {
    fixture.componentRef.setInput('size', size);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('Price', () => {
  it('formats the price German with the tenth of a cent raised', async () => {
    const element = await render(1.859);

    expect(accessibleTextOf(element)).toBe('1,859 €');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('1,859 €');
    expect(element.querySelector('sup')?.textContent).toBe('9');
  });

  it('pads prices with fewer decimals', async () => {
    const element = await render(1.8);

    expect(accessibleTextOf(element)).toBe('1,800 €');
  });

  it('shows a dash that reads as "kein Preis" without a price', async () => {
    const element = await render(null);

    expect(accessibleTextOf(element)).toBe('kein Preis');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('–');
    expect(element.querySelector('sup')).toBeNull();
  });

  it('renders the list size by default and the requested size otherwise', async () => {
    expect((await render(1.859)).classList).toContain('price--list');
    expect((await render(1.859, 'hero')).classList).toContain('price--hero');
  });
});
