import { Component, Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { injectCurrentUrl } from './current-url';

@Component({ template: '' })
class EmptyPage {}

describe('injectCurrentUrl', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: '', component: EmptyPage },
          { path: 'favorites', component: EmptyPage },
          { path: 'old-favorites', redirectTo: 'favorites' },
        ]),
      ],
    });
  });

  const currentUrl = () => runInInjectionContext(TestBed.inject(Injector), injectCurrentUrl);

  it('starts with the URL already reached', async () => {
    await TestBed.inject(Router).navigateByUrl('/favorites');

    expect(currentUrl()().toString()).toBe('/favorites');
  });

  it('follows every navigation, after redirects', async () => {
    const url = currentUrl();

    await TestBed.inject(Router).navigateByUrl('/old-favorites');

    expect(url().toString()).toBe('/favorites');
  });
});
