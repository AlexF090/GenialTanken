import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { ApplicationRef, Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavigationEnd, provideRouter, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { injectCloseToExplore } from './close-to-explore';

@Component({ template: '' })
class EmptyPage {}

describe('injectCloseToExplore', () => {
  let router: Router;
  let location: Location;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'settings', component: EmptyPage },
          { path: 'favorites', component: EmptyPage },
          { path: 'stations/:id', component: EmptyPage },
        ]),
        provideLocationMocks(),
      ],
    });
    router = TestBed.inject(Router);
    location = TestBed.inject(Location);
    // Listens to Back and Forward, as the app does once it boots.
    router.setUpLocationChangeListener();
  });

  const close = async () => {
    runInInjectionContext(TestBed.inject(Injector), injectCloseToExplore)();
    await TestBed.inject(ApplicationRef).whenStable();
  };

  /** The path of the current history entry; the router follows it in a task of its own. */
  const currentPath = () => location.path() || '/';

  it('goes back to the explore page it came from, so Back does not reopen what was closed', async () => {
    await router.navigateByUrl('/');
    await router.navigateByUrl('/settings');

    await close();

    expect(currentPath()).toBe('/');
    location.forward();
    expect(currentPath()).toBe('/settings');
  });

  it('keeps the search of the explore page it goes back to', async () => {
    await router.navigateByUrl('/?latitude=48.86');
    await router.navigateByUrl('/favorites');

    await close();

    expect(currentPath()).toBe('/?latitude=48.86');
  });

  it('replaces a deep link with the explore page', async () => {
    await router.navigateByUrl('/stations/fr-75001001');

    await close();

    expect(router.url).toBe('/');
    location.back();
    expect(currentPath()).toBe('/');
  });

  it('replaces the entry when it came from another card', async () => {
    await router.navigateByUrl('/');
    await router.navigateByUrl('/favorites');
    await router.navigateByUrl('/stations/fr-75001001');

    await close();

    expect(router.url).toBe('/');
    location.back();
    expect(currentPath()).toBe('/favorites');
  });

  it('replaces the entry when Back or Forward led here, as the entry before is unknown then', async () => {
    await router.navigateByUrl('/favorites');
    await router.navigateByUrl('/settings');
    await router.navigateByUrl('/');
    await navigated(() => {
      location.back();
    });
    expect(router.url).toBe('/settings');

    await close();

    expect(currentPath()).toBe('/');
    location.back();
    expect(currentPath()).toBe('/favorites');
  });
});

/** Resolves once the router has followed a move through the history, which it does in a task. */
const navigated = (move: () => void): Promise<unknown> => {
  const router = TestBed.inject(Router);
  const navigationEnd = firstValueFrom(
    router.events.pipe(filter(event => event instanceof NavigationEnd))
  );
  move();
  return navigationEnd;
};
