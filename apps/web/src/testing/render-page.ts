import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { EnvironmentProviders, InputSignalWithTransform, Provider, Type } from '@angular/core';
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

/**
 * Taken before any test can install fake timers (`vi.useFakeTimers()`), so `settle` keeps
 * working in tests that use them.
 */
const realSetTimeout = globalThis.setTimeout;

/**
 * Resolves once every microtask queued so far, and every microtask those queue in turn, has run:
 * a macrotask only starts on an empty microtask queue. It waits for no time to pass.
 */
const afterQueuedMicrotasks = (): Promise<void> =>
  new Promise(resolve => {
    realSetTimeout(resolve, 0);
  });

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
      await afterQueuedMicrotasks();
      TestBed.tick();
    },
  };
};

export interface RenderedComponent<T> {
  fixture: ComponentFixture<T>;
  element: HTMLElement;
}

/** The fixture's host element, typed. */
export const hostElementOf = (fixture: ComponentFixture<unknown>): HTMLElement => {
  const element: unknown = fixture.nativeElement;
  if (!(element instanceof HTMLElement)) {
    throw new Error('The component fixture has no HTML host element');
  }
  return element;
};

export const renderComponent = async <T>(component: Type<T>): Promise<RenderedComponent<T>> => {
  const fixture = TestBed.createComponent(component);
  // `whenStable` would wait for the page's open requests, which the test flushes later.
  TestBed.tick();
  await Promise.resolve();
  return { fixture, element: hostElementOf(fixture) };
};

/** Values for the component's signal inputs, keyed by input name. */
export type InputValues<T> = {
  [
    Name in keyof T as T[Name] extends InputSignalWithTransform<unknown, unknown> ? Name : never
  ]?: T[Name] extends InputSignalWithTransform<unknown, infer Value> ? Value : never;
};

/**
 * Renders a presentational component with the given inputs and waits until it is stable. Inputs
 * given as `undefined` keep their default.
 */
export const renderWithInputs = async <T>(
  component: Type<T>,
  inputs: InputValues<T>,
  providers: (Provider | EnvironmentProviders)[] = []
): Promise<RenderedComponent<T>> => {
  if (providers.length > 0) {
    TestBed.configureTestingModule({ providers });
  }
  const fixture = TestBed.createComponent(component);
  for (const [name, value] of Object.entries(inputs)) {
    if (value !== undefined) {
      fixture.componentRef.setInput(name, value);
    }
  }
  await fixture.whenStable();
  return { fixture, element: hostElementOf(fixture) };
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

/** Titles of the station list's rows, in their order. */
export const stationTitles = (container: HTMLElement): string[] =>
  [...container.querySelectorAll('main li .station-row__title')].map(title => textOf(title));

/** The radio button whose label reads `name`. */
export const getRadio = (container: HTMLElement, name: string): HTMLInputElement => {
  const label = [...container.querySelectorAll('label')].find(
    candidate => textOf(candidate) === name
  );
  const radio = label?.querySelector('input[type="radio"]');
  if (!(radio instanceof HTMLInputElement)) {
    throw new Error(`No radio button labelled "${name}" found`);
  }
  return radio;
};
