import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { PageHeader } from './page-header';

const render = async () => {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(PageHeader);
  fixture.componentRef.setInput('title', 'GenialTanken');
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

describe('PageHeader', () => {
  it('credits the French government open data as price source', async () => {
    const element = await render();
    const attribution = element.querySelector<HTMLAnchorElement>(
      'a[href="https://www.prix-carburants.gouv.fr/"]'
    );

    expect(attribution?.textContent).toContain('Preisdaten: prix-carburants.gouv.fr');
    expect(element.textContent).not.toContain('TankenTanken');
  });
});
