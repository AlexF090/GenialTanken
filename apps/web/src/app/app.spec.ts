import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { configurePageTest, textOf } from '../testing/render-page';
import type { PageTestContext } from '../testing/render-page';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  let context: PageTestContext;

  const navigateTo = async (url: string) => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await context.settle();
    return fixture.nativeElement as HTMLElement;
  };

  const navigationLink = (element: HTMLElement, name: string): HTMLAnchorElement => {
    const link = [...element.querySelectorAll('nav a')].find(
      candidate => textOf(candidate) === name
    );
    if (!(link instanceof HTMLAnchorElement)) {
      throw new Error(`No navigation link named "${name}" found`);
    }
    return link;
  };

  beforeEach(() => {
    context = configurePageTest({ routes });
  });

  afterEach(() => {
    context.httpTesting.verify();
  });

  it('has a labelled main navigation that marks the current page', async () => {
    const element = await navigateTo('/');

    expect(element.querySelector('nav')?.getAttribute('aria-label')).toBe('Hauptnavigation');
    expect([...element.querySelectorAll('nav a')].map(link => textOf(link))).toEqual([
      'Erkunden',
      'Favoriten',
      'Einstellungen',
    ]);
    expect(navigationLink(element, 'Erkunden').getAttribute('aria-current')).toBe('page');
    expect(navigationLink(element, 'Einstellungen').getAttribute('aria-current')).toBeNull();
    context.httpTesting.expectOne(request => request.url === '/api/stations');
  });

  it('offers a skip link to the content as the first focusable element', async () => {
    const element = await navigateTo('/favorites');

    const skipLink = element.querySelector('a');
    expect(textOf(skipLink)).toBe('Zum Inhalt springen');
    const target = element.querySelector(`#${skipLink?.getAttribute('href')?.slice(1) ?? ''}`);
    expect(target?.getAttribute('tabindex')).toBe('-1');
    expect(target?.querySelector('main')).not.toBeNull();
    expect(target?.querySelector('nav')).toBeNull();
  });

  it('moves focus to the content without leaving the page when the skip link is used', async () => {
    const element = await navigateTo('/favorites');
    const skipLink = element.querySelector('a');

    skipLink?.click();

    expect(document.activeElement?.id).toBe('main-content');
    expect(TestBed.inject(Router).url).toBe('/favorites');
  });

  it.each(['/', '/favorites', '/settings', '/stations/fr-75001001', '/unknown'])(
    'renders exactly one main and navigation landmark on %s',
    async url => {
      const element = await navigateTo(url);

      expect(element.querySelectorAll('main')).toHaveLength(1);
      expect(element.querySelectorAll('nav')).toHaveLength(1);
      context.httpTesting.match(() => true);
    }
  );

  it.each(['/favorites', '/settings', '/stations/fr-75001001', '/unknown'])(
    'renders exactly one page header on %s',
    async url => {
      const element = await navigateTo(url);

      expect(element.querySelectorAll('header')).toHaveLength(1);
      context.httpTesting.match(() => true);
    }
  );

  it('opens the explore page with list and map as start page', async () => {
    const element = await navigateTo('/');

    expect(textOf(element.querySelector('main h1'))).toBe('GenialTanken');
    expect(element.querySelector('main app-station-list')).not.toBeNull();
    expect(element.querySelector('main app-stations-map')).not.toBeNull();
    expect(document.title).toBe('GenialTanken');
    context.httpTesting.expectOne(request => request.url === '/api/stations');
  });

  it('redirects the former map page to the explore page', async () => {
    const element = await navigateTo('/map');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(navigationLink(element, 'Erkunden').getAttribute('aria-current')).toBe('page');
    context.httpTesting.expectOne(request => request.url === '/api/stations');
  });

  it('reaches the settings through the navigation', async () => {
    const element = await navigateTo('/settings');

    expect(navigationLink(element, 'Einstellungen').getAttribute('aria-current')).toBe('page');
    expect(navigationLink(element, 'Erkunden').getAttribute('aria-current')).toBeNull();
    expect(textOf(element.querySelector('h1'))).toBe('Einstellungen');
  });

  it('opens the detail page under /stations/:id', async () => {
    const element = await navigateTo('/stations/fr-75001001');

    expect(textOf(element.querySelector('h1'))).toBe('Details');
    context.httpTesting.expectOne('/api/stations/fr-75001001');
  });

  it.each(['/unknown', '/unknown/deep/route', '/stations'])(
    'shows the 404 page with the navigation for %s',
    async url => {
      const element = await navigateTo(url);

      expect(textOf(element.querySelector('main h2'))).toBe('ERROR 404');
      expect(element.querySelector('main')?.textContent).toContain('Diese Seite existiert nicht');
      expect(textOf(element.querySelector('main a[href="/"]'))).toBe('Zur Startseite');
      expect(element.querySelector('nav')).not.toBeNull();
    }
  );
});
