import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { textOf } from '../../../testing/render-page';
import { NavigationBar } from './navigation-bar';

@Component({ template: '' })
class EmptyPage {}

const render = async (url: string) => {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([
        { path: '', component: EmptyPage },
        { path: 'favorites', component: EmptyPage },
        { path: 'settings', component: EmptyPage },
        { path: 'stations/:id', component: EmptyPage },
      ]),
    ],
  });
  const fixture = TestBed.createComponent(NavigationBar);
  await TestBed.inject(Router).navigateByUrl(url);
  await fixture.whenStable();
  return fixture.nativeElement as HTMLElement;
};

const linkNamed = (element: HTMLElement, name: string): HTMLAnchorElement => {
  const link = [...element.querySelectorAll('a')].find(candidate => textOf(candidate) === name);
  if (link === undefined) {
    throw new Error(`No link named "${name}" found`);
  }
  return link;
};

const currentLinks = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('a[aria-current="page"]')].map(link => textOf(link));

describe('NavigationBar', () => {
  it('is a labelled navigation with explore, favorites and settings', async () => {
    const element = await render('/');

    const navigation = element.querySelector('nav');
    expect(navigation?.getAttribute('aria-label')).toBe('Hauptnavigation');
    expect([...element.querySelectorAll('nav li a')].map(link => textOf(link))).toEqual([
      'Erkunden',
      'Favoriten',
      'Einstellungen',
    ]);
    expect(linkNamed(element, 'Erkunden').getAttribute('href')).toBe('/');
    expect(linkNamed(element, 'Favoriten').getAttribute('href')).toBe('/favorites');
    expect(linkNamed(element, 'Einstellungen').getAttribute('href')).toBe('/settings');
  });

  it.each([
    ['/', 'Erkunden'],
    ['/favorites', 'Favoriten'],
    ['/settings', 'Einstellungen'],
  ])('marks only the link of %s as the current page', async (url, name) => {
    const element = await render(url);

    expect(currentLinks(element)).toEqual([name]);
  });

  it('does not mark explore as current on pages below the root', async () => {
    const element = await render('/stations/fr-75001001');

    expect(currentLinks(element)).toEqual([]);
  });
});
