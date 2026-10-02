import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { Type } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import type { Routes } from '@angular/router';
import { BROWSER_STORAGE } from '../app/core/browser-storage';
import { provideLocalStorageFavorites } from '../app/core/favorites/local-storage-favorites-repository';
import { GEOLOCATION } from '../app/core/geolocation/geolocation-service';
import { FakeGeolocation } from './fake-geolocation';
import { FakeStorage } from './fake-storage';

export interface PageTestContext {
  storage: FakeStorage;
  geolocation: FakeGeolocation;
  httpTesting: HttpTestingController;
  /**
   * Runs change detection, lets flushed HTTP responses propagate through the resources, then
   * renders again. Unlike `whenStable` it does not wait for requests that are still open.
   */
  settle: () => Promise<void>;
}

/** Providers shared by page tests: real stores and API on top of fake browser seams. */
export const configurePageTest = (
  options: { storage?: FakeStorage; routes?: Routes } = {}
): PageTestContext => {
  const storage = options.storage ?? new FakeStorage();
  const geolocation = new FakeGeolocation();
  TestBed.configureTestingModule({
    providers: [
      provideRouter(options.routes ?? [], withComponentInputBinding()),
      provideHttpClient(),
      provideHttpClientTesting(),
      provideLocalStorageFavorites(),
      { provide: BROWSER_STORAGE, useValue: storage },
      { provide: GEOLOCATION, useValue: geolocation },
    ],
  });
  return {
    storage,
    geolocation,
    httpTesting: TestBed.inject(HttpTestingController),
    settle: async () => {
      TestBed.tick();
      await new Promise(resolve => setTimeout(resolve));
      TestBed.tick();
    },
  };
};

export const renderComponent = async <T>(
  component: Type<T>
): Promise<{ fixture: ComponentFixture<T>; element: HTMLElement }> => {
  const fixture = TestBed.createComponent(component);
  // `whenStable` would wait for the page's open requests, which the test flushes later.
  TestBed.tick();
  await Promise.resolve();
  return { fixture, element: fixture.nativeElement as HTMLElement };
};

/** Visible text with collapsed whitespace, e.g. for comparing headings and messages. */
export const textOf = (element: Element | null | undefined): string =>
  (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Text as read by screen readers: content hidden with `aria-hidden` is left out. */
export const accessibleTextOf = (element: Element | null | undefined): string => {
  if (element === null || element === undefined) {
    return '';
  }
  const copy = element.cloneNode(true);
  if (!(copy instanceof Element)) {
    return '';
  }
  for (const hiddenElement of copy.querySelectorAll('[aria-hidden="true"]')) {
    hiddenElement.remove();
  }
  return textOf(copy);
};

export const getButton = (container: HTMLElement, name: RegExp | string): HTMLButtonElement => {
  const button = [...container.querySelectorAll('button')].find(candidate => {
    const accessibleName = candidate.getAttribute('aria-label') ?? textOf(candidate);
    return typeof name === 'string' ? accessibleName === name : name.test(accessibleName);
  });
  if (button === undefined) {
    throw new Error(`No button named ${String(name)} found`);
  }
  return button;
};
