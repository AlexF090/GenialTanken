import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { SettingsStore } from '../../core/settings/settings-store';
import { FakeStorage, storedSettings } from '../../../testing/fake-storage';
import {
  configurePageTest,
  getButton,
  getRadio,
  renderComponent,
  textOf,
} from '../../../testing/render-page';
import type { PageTestContext } from '../../../testing/render-page';
import { Router } from '@angular/router';
import { SettingsPage } from './settings-page';
import { SETTINGS_STORAGE_KEY } from '../../core/settings/settings-store';

const radiusSlider = (element: HTMLElement): HTMLInputElement => {
  const slider = element.querySelector('input[type="range"]');
  if (!(slider instanceof HTMLInputElement)) {
    throw new Error('No radius slider found');
  }
  return slider;
};

/** The label the slider is associated with, as screen readers name it. */
const radiusLabel = (element: HTMLElement): HTMLLabelElement | undefined =>
  radiusSlider(element).labels?.[0];

describe('SettingsPage', () => {
  let context: PageTestContext;

  afterEach(() => {
    context.httpTesting.verify();
  });

  it('offers every fuel type with E5 selected and a 5 km radius', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    expect(textOf(element.querySelector('legend'))).toBe('Kraftstoff');
    expect(
      [...(element.querySelector('fieldset')?.querySelectorAll('label') ?? [])].map(label =>
        textOf(label)
      )
    ).toEqual(['E5', 'E10', 'Super Plus', 'Diesel', 'E85', 'LPG']);
    expect(getRadio(element, 'E5').checked).toBe(true);
    expect(getRadio(element, 'E10').checked).toBe(false);
    expect(textOf(radiusLabel(element))).toBe('Radius: 5 km');
    expect(radiusSlider(element).value).toBe('5');
    expect(radiusSlider(element).min).toBe('1');
    expect(radiusSlider(element).max).toBe('30');
  });

  it('applies and persists a new fuel type immediately', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    getRadio(element, 'Diesel').click();
    await context.settle();

    expect(TestBed.inject(SettingsStore).fuelType()).toBe('diesel');
    expect(storedSettings(context.storage)).toBe(
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

    expect(textOf(radiusLabel(element))).toBe('Radius: 15 km');
    expect(TestBed.inject(SettingsStore).radiusInKilometers()).toBe(15);
    expect(storedSettings(context.storage)).toBe(
      '{"fuelType":"e5","radiusInKilometers":15,"colorScheme":"system"}'
    );
  });

  it('orders the sections fuel, radius, appearance and data source without any button', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);
    const content = element.querySelector('.settings');

    expect(
      [...(content?.querySelectorAll('legend, label[for], h2') ?? [])].map(title => textOf(title))
    ).toEqual(['Kraftstoff', 'Radius: 5 km', 'Darstellung', 'Datenquelle']);
    expect(content?.querySelectorAll('button')).toHaveLength(0);
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
    expect(getRadio(element, 'System').checked).toBe(true);
  });

  it('applies and persists a new appearance immediately', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    getRadio(element, 'Dunkel').click();
    await context.settle();

    expect(TestBed.inject(SettingsStore).colorScheme()).toBe('dark');
    expect(getRadio(element, 'Dunkel').checked).toBe(true);
    expect(storedSettings(context.storage)).toBe(
      '{"fuelType":"e5","radiusInKilometers":5,"colorScheme":"dark"}'
    );
  });

  it('keeps an appearance changed elsewhere when the fuel type changes', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);
    const settingsStore = TestBed.inject(SettingsStore);

    settingsStore.update({ colorScheme: 'light' });
    await context.settle();
    getRadio(element, 'Diesel').click();
    await context.settle();

    expect(settingsStore.settings()).toEqual({
      fuelType: 'diesel',
      radiusInKilometers: 5,
      colorScheme: 'light',
    });
    expect(getRadio(element, 'Hell').checked).toBe(true);
  });

  it('credits the data source with a link that opens in a new tab', async () => {
    context = configurePageTest();
    const { element } = await renderComponent(SettingsPage);

    const link = element.querySelector('section a');
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
        [SETTINGS_STORAGE_KEY]: '{"fuelType":"e10","radiusInKilometers":20}',
      }),
    });
    const { element } = await renderComponent(SettingsPage);

    expect(getRadio(element, 'E10').checked).toBe(true);
    expect(radiusSlider(element).value).toBe('20');
    expect(textOf(radiusLabel(element))).toBe('Radius: 20 km');
  });

  it('opens as a modal dialog titled "Einstellungen" without a landmark of its own', async () => {
    context = configurePageTest();
    const { fixture, element } = await renderComponent(SettingsPage);
    await fixture.whenStable();

    const dialog = element.querySelector('dialog');
    expect(dialog?.hasAttribute('open')).toBe(true);
    expect(textOf(dialog?.querySelector(`#${dialog.getAttribute('aria-labelledby') ?? ''}`))).toBe(
      'Einstellungen'
    );
    expect(element.querySelector('main, h1, header')).toBeNull();
  });

  describe('closing', () => {
    const renderOpened = async (urls: string[]) => {
      context = configurePageTest({
        routes: [
          { path: '', children: [] },
          { path: 'settings', children: [] },
        ],
        providers: [provideLocationMocks()],
      });
      for (const url of urls) {
        await TestBed.inject(Router).navigateByUrl(url);
      }
      const rendered = await renderComponent(SettingsPage);
      await rendered.fixture.whenStable();
      return { ...rendered, location: TestBed.inject(Location) };
    };

    it('goes back to the explore page it was opened from', async () => {
      const { element, location } = await renderOpened(['/', '/settings']);

      getButton(element, 'Schließen').click();
      await context.settle();

      expect(location.path() || '/').toBe('/');
      location.forward();
      expect(location.path()).toBe('/settings');
    });

    it('replaces a deep link with the explore page, so Back does not open it again', async () => {
      const { element, location } = await renderOpened(['/settings']);

      getButton(element, 'Schließen').click();
      await context.settle();
      await context.settle();

      expect(TestBed.inject(Router).url).toBe('/');
      location.back();
      expect(location.path()).not.toBe('/settings');
    });
  });
});
