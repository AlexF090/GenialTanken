import type { ComponentFixture } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { stationsUrl } from '../../../testing/api-urls';
import { textOf } from '../../../testing/render-page';

/** Shared by the explore page specs. */
export const EIFFEL_TOWER_E5_URL = stationsUrl({ latitude: 48.8584, longitude: 2.2945 });

export const selectedStationTitles = (element: HTMLElement): string[] =>
  [...element.querySelectorAll('main li .station-row__title[aria-pressed="true"]')].map(title =>
    textOf(title)
  );

/** The line with the number of stations; the place search announces in a status of its own. */
export const resultSummaryElement = (element: HTMLElement): HTMLElement | null =>
  element.querySelector('main app-bottom-sheet .explore-page__summary[role="status"]');

export const placeSearchInput = (element: HTMLElement): HTMLInputElement => {
  const input = element.querySelector<HTMLInputElement>('input[role="combobox"]');
  if (input === null) {
    throw new Error('No place search field');
  }
  return input;
};

export const childComponent = <T>(
  fixture: ComponentFixture<unknown>,
  type: new (...constructorArguments: never[]) => T
): T => {
  const instance: unknown = fixture.debugElement.query(By.directive(type)).componentInstance;
  if (!(instance instanceof type)) {
    throw new Error(`No ${type.name} rendered`);
  }
  return instance;
};
