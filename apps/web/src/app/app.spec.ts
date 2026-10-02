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
      'Start',
      'Karte',
      'Favoriten',
    ]);
    expect(navigationLink(element, 'Start').getAttribute('aria-current')).toBe('page');
    expect(navigationLink(element, 'Karte').getAttribute('aria-current')).toBeNull();
    context.httpTesting.expectOne(request => request.url === '/api/stations');
  });

  it('renders header, main content and navigation landmarks', async () => {
    const element = await navigateTo('/favorites');

    expect(element.querySelectorAll('header')).toHaveLength(1);
    expect(element.querySelectorAll('main')).toHaveLength(1);
    expect(element.querySelectorAll('nav')).toHaveLength(1);
    expect(navigationLink(element, 'Favoriten').getAttribute('aria-current')).toBe('page');
    expect(navigationLink(element, 'Start').getAttribute('aria-current')).toBeNull();
  });

  it('links the header settings icon as a plain link marked current on /settings', async () => {
    const element = await navigateTo('/settings');

    const settingsLink = element.querySelector('header a[aria-label="Einstellungen"]');
    expect(settingsLink?.getAttribute('href')).toBe('/settings');
    expect(settingsLink?.hasAttribute('role')).toBe(false);
    expect(settingsLink?.getAttribute('aria-current')).toBe('page');
    expect(textOf(element.querySelector('h1'))).toBe('Einstellungen');
  });

  it('opens the detail page under /stations/:id', async () => {
    const element = await navigateTo('/stations/fr-75001001');

    expect(textOf(element.querySelector('h1'))).toBe('Details');
    context.httpTesting.expectOne('/api/stations/fr-75001001');
  });

  it.each(['/unknown', '/unknown/deep/route', '/stations'])(
    'shows the 404 page for %s',
    async url => {
      const element = await navigateTo(url);

      expect(textOf(element.querySelector('main h2'))).toBe('ERROR 404');
      expect(element.querySelector('main')?.textContent).toContain('Diese Seite existiert nicht');
    }
  );
});
