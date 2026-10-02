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
    expect(
      [...(element.querySelector('fieldset')?.querySelectorAll('label') ?? [])].map(label =>
        textOf(label)
      )
    ).toEqual(['E5', 'E10', 'Super Plus', 'Diesel', 'E85', 'LPG']);
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

  it('orders the sections fuel, radius, appearance and data source without any button', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);
    const main = element.querySelector('main');

    expect(
      [...(main?.querySelectorAll('legend, label[for="radius"], h2') ?? [])].map(title =>
        textOf(title)
      )
    ).toEqual(['Kraftstoff', 'Radius: 5 km', 'Darstellung', 'Datenquelle']);
    expect(main?.querySelectorAll('button')).toHaveLength(0);
  });

  it('offers system, light and dark appearance with system selected', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);
    const appearance = [...element.querySelectorAll('fieldset')].find(
      fieldset => textOf(fieldset.querySelector('legend')) === 'Darstellung'
    );

    expect([...(appearance?.querySelectorAll('label') ?? [])].map(label => textOf(label))).toEqual([
      'System',
      'Hell',
      'Dunkel',
    ]);
    expect(radioNamed(element, 'System').checked).toBe(true);
  });

  it('applies and persists a new appearance immediately', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    radioNamed(element, 'Dunkel').click();
    await context.settle();

    expect(TestBed.inject(SettingsStore).colorScheme()).toBe('dark');
    expect(radioNamed(element, 'Dunkel').checked).toBe(true);
    expect(context.storage.getItem('genialtanken.settings')).toBe(
      '{"fuelType":"e5","radiusInKilometers":5,"colorScheme":"dark"}'
    );
  });

  it('keeps an appearance changed elsewhere when the fuel type changes', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);
    const settingsStore = TestBed.inject(SettingsStore);

    settingsStore.update({ colorScheme: 'light' });
    await context.settle();
    radioNamed(element, 'Diesel').click();
    await context.settle();

    expect(settingsStore.settings()).toEqual({
      fuelType: 'diesel',
      radiusInKilometers: 5,
      colorScheme: 'light',
    });
    expect(radioNamed(element, 'Hell').checked).toBe(true);
  });

  it('credits the data source with a link that opens in a new tab', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    const link = element.querySelector('main section a');
    expect(textOf(link)).toBe('prix-carburants.gouv.fr (öffnet in neuem Tab)');
    expect(link?.getAttribute('href')).toBe(
      'https://www.prix-carburants.gouv.fr/rubrique/opendata/'
    );
    expect(link?.getAttribute('target')).toBe('_blank');
    expect(link?.getAttribute('rel')).toBe('noopener noreferrer');
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
