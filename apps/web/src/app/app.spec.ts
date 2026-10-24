import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { accessibleTextOf, configurePageTest, hostElementOf, textOf } from '../testing/render-page';
import type { PageTestContext } from '../testing/render-page';
import { App } from './app';
import { routes } from './app.routes';
import { STATIONS_URL, stationUrl } from '../testing/api-urls';
import { FakeServiceWorkerUpdate } from '../testing/fake-service-worker-update';
import { FakeStorage } from '../testing/fake-storage';
import {
  AUTOMATIC_RELOAD_STORAGE_KEY,
  RELOAD_PAGE,
} from './core/application-update/application-update-store';
import { SESSION_STORAGE } from './core/browser-storage';
import { LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS } from './ui/update-notice/update-notice';

describe('App', () => {
  let context: PageTestContext;

  const navigateTo = async (url: string) => {
    const fixture = TestBed.createComponent(App);
    await TestBed.inject(Router).navigateByUrl(url);
    await context.settle();
    return hostElementOf(fixture);
  };

  beforeEach(() => {
    context = configurePageTest({ routes });
  });

  afterEach(() => {
    context.httpTesting.verify();
  });

  it.each(['/', '/favorites', '/unknown'])(
    'offers a skip link to the main content of %s as the first focusable element',
    async url => {
      const element = await navigateTo(url);

      const skipLink = element.querySelector('a');
      expect(textOf(skipLink)).toBe('Zum Inhalt springen');
      const target = element.querySelector(`#${skipLink?.getAttribute('href')?.slice(1) ?? ''}`);
      expect(target?.tagName).toBe('MAIN');
      expect(target?.getAttribute('tabindex')).toBe('-1');
      context.httpTesting.match(() => true);
    }
  );

  it('moves focus to the content without leaving the page when the skip link is used', async () => {
    const element = await navigateTo('/favorites');
    const skipLink = element.querySelector('a');

    skipLink?.click();

    expect(document.activeElement?.tagName).toBe('MAIN');
    expect(TestBed.inject(Router).url).toBe('/favorites');
    context.httpTesting.match(() => true);
  });

  it.each(['/', '/favorites', '/settings', '/stations/fr-75001001', '/unknown'])(
    'renders exactly one main landmark and no navigation bar on %s',
    async url => {
      const element = await navigateTo(url);

      expect(element.querySelectorAll('main')).toHaveLength(1);
      expect(element.querySelectorAll('nav')).toHaveLength(0);
      context.httpTesting.match(() => true);
    }
  );

  it.each([
    ['/unknown', 1],
    ['/favorites', 0],
    ['/settings', 0],
  ])('renders a page header only on pages without the map: %s', async (url, headerCount) => {
    const element = await navigateTo(url);

    expect(element.querySelectorAll('header')).toHaveLength(headerCount);
    context.httpTesting.match(() => true);
  });

  it('opens the explore page with list and map as start page', async () => {
    const element = await navigateTo('/');

    expect(accessibleTextOf(element.querySelector('main h1'))).toBe('GenialTanken');
    expect(element.querySelector('main app-station-list')).not.toBeNull();
    expect(element.querySelector('main app-stations-map')).not.toBeNull();
    expect(document.title).toBe('GenialTanken');
    context.httpTesting.expectOne(request => request.url === STATIONS_URL);
  });

  it('redirects the former map page to the explore page', async () => {
    const element = await navigateTo('/map');

    expect(TestBed.inject(Router).url).toBe('/');
    expect(element.querySelector('main app-stations-map')).not.toBeNull();
    context.httpTesting.expectOne(request => request.url === STATIONS_URL);
  });

  it('opens the settings as a dialog over the explore page', async () => {
    const element = await navigateTo('/settings');

    expect(accessibleTextOf(element.querySelector('main h1'))).toBe('GenialTanken');
    expect(element.querySelector('main app-stations-map')).not.toBeNull();
    const dialog = element.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(textOf(dialog?.querySelector('h2'))).toBe('Einstellungen');
    expect(document.title).toBe('Einstellungen – GenialTanken');
    context.httpTesting.expectOne(request => request.url === STATIONS_URL);
  });

  it('returns to the list when the settings close and focuses the settings button', async () => {
    const element = await navigateTo('/settings');
    context.httpTesting.expectOne(request => request.url === STATIONS_URL);

    element.querySelector('dialog')?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await context.settle();

    expect(TestBed.inject(Router).url).toBe('/');
    expect(element.querySelector('dialog')).toBeNull();
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Einstellungen');
    expect(document.activeElement?.closest('app-bottom-sheet')).not.toBeNull();
  });

  it('opens the favorites in the sheet of the explore page instead of the list', async () => {
    const element = await navigateTo('/favorites');

    expect(element.querySelector('main app-stations-map')).not.toBeNull();
    expect(element.querySelector('main app-bottom-sheet app-favorites-page')).not.toBeNull();
    expect(element.querySelector('app-station-list')?.parentElement?.hidden).toBe(true);
    expect(textOf(element.querySelector('app-favorites-page h2'))).toBe('Favoriten');
    expect(document.title).toBe('Favoriten – GenialTanken');
    context.httpTesting.expectOne(request => request.url === STATIONS_URL);
  });

  it('opens a station as a card on the explore page under /stations/:id', async () => {
    const element = await navigateTo('/stations/fr-75001001');

    expect(accessibleTextOf(element.querySelector('main h1'))).toBe('GenialTanken');
    expect(element.querySelector('main app-stations-map')).not.toBeNull();
    expect(element.querySelector('main app-station-detail-page')).not.toBeNull();
    expect(document.title).toBe('Details – GenialTanken');
    context.httpTesting.expectOne(stationUrl('fr-75001001'));
    context.httpTesting.expectOne(request => request.url === STATIONS_URL);
  });

  it.each(['/unknown', '/unknown/deep/route', '/stations'])(
    'shows the 404 page with a link back to the map for %s',
    async url => {
      const element = await navigateTo(url);

      expect(textOf(element.querySelector('main h2'))).toBe('Fehler 404');
      expect(element.querySelector('main')?.textContent).toContain('Diese Seite existiert nicht');
      expect(textOf(element.querySelector('main a[href="/"]'))).toBe('Zur Karte');
      expect(element.querySelector('app-stations-map')).toBeNull();
    }
  );

  describe('update notice', () => {
    let serviceWorkerUpdate: FakeServiceWorkerUpdate;
    let reloadPage: ReturnType<typeof vi.fn<() => void>>;

    const notices = (element: HTMLElement): HTMLElement => {
      const region = element.querySelector<HTMLElement>('.shell__notices [role="status"]');
      if (region === null) {
        throw new Error('No notice region rendered');
      }
      return region;
    };

    beforeEach(() => {
      TestBed.resetTestingModule();
      serviceWorkerUpdate = new FakeServiceWorkerUpdate();
      reloadPage = vi.fn<() => void>();
      context = configurePageTest({
        routes,
        providers: [
          { provide: SwUpdate, useValue: serviceWorkerUpdate },
          { provide: RELOAD_PAGE, useValue: reloadPage },
          {
            provide: SESSION_STORAGE,
            useValue: new FakeStorage({ [AUTOMATIC_RELOAD_STORAGE_KEY]: 'true' }),
          },
        ],
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    /** A notice fills its status region a moment after the region renders. */
    const settleAnnouncement = async () => {
      await context.settle();
      vi.advanceTimersByTime(LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS);
      await context.settle();
    };

    it('keeps an empty status region until a new version is ready', async () => {
      const element = await navigateTo('/unknown');

      expect(notices(element).getAttribute('role')).toBe('status');
      expect(textOf(notices(element))).toBe('');
    });

    it('offers a reload once a new version is ready and keeps it open', async () => {
      vi.useFakeTimers();
      const element = await navigateTo('/unknown');

      serviceWorkerUpdate.announceReadyVersion();
      await context.settle();
      vi.advanceTimersByTime(60_000);
      await context.settle();

      expect(notices(element).querySelector('p')?.textContent).toBe('Neue Version verfügbar');
      expect(textOf(notices(element).querySelector('button'))).toBe('Neu laden');
    });

    it('activates the new version and reloads on request', async () => {
      vi.useFakeTimers();
      const element = await navigateTo('/unknown');
      serviceWorkerUpdate.announceReadyVersion();
      await settleAnnouncement();

      notices(element).querySelector('button')?.click();
      await context.settle();

      expect(serviceWorkerUpdate.activations).toBe(1);
      expect(reloadPage).toHaveBeenCalledOnce();
    });

    it('asks for a reload by hand once reloading on its own did not repair the cache', async () => {
      vi.useFakeTimers();
      const element = await navigateTo('/unknown');

      serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });
      await settleAnnouncement();

      expect(reloadPage).not.toHaveBeenCalled();
      expect(notices(element).querySelector('p')?.textContent).toBe(
        'Die App muss neu geladen werden.'
      );
      notices(element).querySelector('button')?.click();
      await context.settle();
      expect(reloadPage).toHaveBeenCalledOnce();
      expect(serviceWorkerUpdate.activations).toBe(0);
    });

    it('shows the notice inside the open settings dialog, which makes the page inert', async () => {
      vi.useFakeTimers();
      const element = await navigateTo('/settings');
      context.httpTesting.match(() => true);

      serviceWorkerUpdate.announceReadyVersion();
      await settleAnnouncement();

      const dialog = element.querySelector('dialog');
      expect(dialog?.querySelector('[role="status"]')?.textContent).toContain(
        'Neue Version verfügbar'
      );
      expect(element.querySelector<HTMLElement>('.shell__notices')?.hidden).toBe(true);
      dialog?.querySelector<HTMLButtonElement>('[role="status"] button')?.click();
      await context.settle();
      expect(reloadPage).toHaveBeenCalledOnce();
    });

    it('shows the notice over the page again once the settings close', async () => {
      vi.useFakeTimers();
      const element = await navigateTo('/settings');
      context.httpTesting.match(() => true);
      serviceWorkerUpdate.announceReadyVersion();
      await settleAnnouncement();

      await TestBed.inject(Router).navigateByUrl('/');
      await settleAnnouncement();

      expect(element.querySelector<HTMLElement>('.shell__notices')?.hidden).toBe(false);
      expect(textOf(notices(element))).toContain('Neue Version verfügbar');
    });
  });
});
