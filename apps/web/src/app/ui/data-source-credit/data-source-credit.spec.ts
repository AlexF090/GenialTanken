import { TestBed } from '@angular/core/testing';
import { accessibleTextOf, textOf } from '../../../testing/render-page';
import { DataSourceCredit } from './data-source-credit';

const render = async (): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(DataSourceCredit);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('DataSourceCredit', () => {
  it('credits the French price data with a link that opens in a new tab', async () => {
    const element = await render();

    const link = element.querySelector('a');
    expect(accessibleTextOf(link)).toBe(
      'Preisdaten: prix-carburants.gouv.fr (öffnet in neuem Tab)'
    );
    expect(link?.getAttribute('href')).toBe('https://www.prix-carburants.gouv.fr/');
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('announces the new tab to screen readers only', async () => {
    const element = await render();

    expect(textOf(element.querySelector('a .visually-hidden'))).toBe('(öffnet in neuem Tab)');
  });
});
