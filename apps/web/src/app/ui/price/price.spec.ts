import { TestBed } from '@angular/core/testing';
import { Price } from './price';

const render = async (priceInEuro: number): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(Price);
  fixture.componentRef.setInput('priceInEuro', priceInEuro);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('Price', () => {
  it('formats the price German with the tenth of a cent raised', async () => {
    const element = await render(1.859);

    expect(element.querySelector('.visually-hidden')?.textContent).toBe('1,859 €');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('1,859 €');
    expect(element.querySelector('sup')?.textContent).toBe('9');
  });

  it('pads prices with fewer decimals', async () => {
    const element = await render(1.8);

    expect(element.querySelector('.visually-hidden')?.textContent).toBe('1,800 €');
  });
});
