import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '../../core/settings/settings-store';
import { FakeStorage } from '../../../testing/fake-storage';
import { configurePageTest, renderComponent, textOf } from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import { SettingsPage } from './settings-page';

const radioNamed = (element: HTMLElement, name: string): HTMLInputElement => {
  const label = [...element.querySelectorAll('label')].find(
    candidate => textOf(candidate) === name
  );
  const radio = label?.querySelector('input[type="radio"]');
  if (!(radio instanceof HTMLInputElement)) {
    throw new Error(`No radio button labelled "${name}" found`);
  }
  return radio;
};

const radiusSlider = (element: HTMLElement): HTMLInputElement => {
  const slider = element.querySelector('input[type="range"]');
  if (!(slider instanceof HTMLInputElement)) {
    throw new Error('No radius slider found');
  }
  return slider;
};

describe('SettingsPage', () => {
  let context: PageTestContext;

  it('offers every fuel type with E5 selected and a 5 km radius', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    expect(textOf(element.querySelector('legend'))).toBe('Kraftstoff');
    expect([...element.querySelectorAll('fieldset label')].map(label => textOf(label))).toEqual([
      'E5',
      'E10',
      'Super Plus',
      'Diesel',
      'E85',
      'LPG',
    ]);
    expect(radioNamed(element, 'E5').checked).toBe(true);
    expect(radioNamed(element, 'E10').checked).toBe(false);
    expect(textOf(element.querySelector('label[for="radius"]'))).toBe('Radius: 5 km');
    expect(radiusSlider(element).value).toBe('5');
    expect(radiusSlider(element).min).toBe('1');
    expect(radiusSlider(element).max).toBe('25');
  });

  it('applies and persists a new fuel type immediately', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    radioNamed(element, 'Diesel').click();
    await context.settle();

    expect(TestBed.inject(SettingsStore).fuelType()).toBe('diesel');
    expect(textOf(element.querySelector('header .page-header__fuel'))).toBe('Kraftstoff: Diesel');
    expect(context.storage.getItem('genialtanken.settings')).toBe(
      '{"fuelType":"diesel","radiusInKilometers":5,"colorScheme":"system"}'
    );
  });

  it('updates the radius label and persists the radius', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);
    const slider = radiusSlider(element);

    slider.value = '15';
    slider.dispatchEvent(new Event('input'));
    await context.settle();

    expect(textOf(element.querySelector('label[for="radius"]'))).toBe('Radius: 15 km');
    expect(TestBed.inject(SettingsStore).radiusInKilometers()).toBe(15);
    expect(context.storage.getItem('genialtanken.settings')).toBe(
      '{"fuelType":"e5","radiusInKilometers":15,"colorScheme":"system"}'
    );
  });

  it('restores the persisted settings', async () => {
    context = configurePageTest({
      storage: new FakeStorage({
        'genialtanken.settings': '{"fuelType":"e10","radiusInKilometers":20}',
      }),
    });
    const { element } = await renderComponent(SettingsPage);

    expect(radioNamed(element, 'E10').checked).toBe(true);
    expect(radiusSlider(element).value).toBe('20');
    expect(textOf(element.querySelector('label[for="radius"]'))).toBe('Radius: 20 km');
  });
});
