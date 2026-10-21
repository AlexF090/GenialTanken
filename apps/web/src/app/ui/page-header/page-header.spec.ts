import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { accessibleTextOf, textOf } from '../../../testing/render-page';
import { PageHeader } from './page-header';

const render = async (inputs: { title: string; backLink?: string }) => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(PageHeader);
  fixture.componentRef.setInput('title', inputs.title);
  if (inputs.backLink !== undefined) {
    fixture.componentRef.setInput('backLink', inputs.backLink);
  }
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('PageHeader', () => {
  it('shows the title as the only heading and no links by default', async () => {
    const element = await render({ title: 'Favoriten' });

    expect(textOf(element.querySelector('header h1'))).toBe('Favoriten');
    expect(element.querySelectorAll('h1, h2, h3')).toHaveLength(1);
    expect(element.querySelectorAll('a')).toHaveLength(0);
  });

  it('links back to the given route', async () => {
    const element = await render({ title: 'Details', backLink: '/favorites' });

    const backLink = element.querySelector('header a');
    expect(accessibleTextOf(backLink)).toBe('Zurück');
    expect(backLink?.getAttribute('href')).toBe('/favorites');
    expect(textOf(element.querySelector('h1'))).toBe('Details');
  });
});
