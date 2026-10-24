import {
  accessibleTextOf,
  getButton,
  renderWithInputs,
  textOf,
} from '../../../testing/render-page';
import { InstallationHintBanner } from './installation-hint-banner';

describe('InstallationHintBanner', () => {
  it('is a region named by its heading', async () => {
    const { element } = await renderWithInputs(InstallationHintBanner, {
      offer: 'home-screen-steps',
    });

    const region = element.querySelector('section');
    const heading = element.querySelector('h2');
    expect(textOf(heading)).toBe('GenialTanken als App');
    expect(region?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('keeps the steps of iOS behind a disclosure button without an install button', async () => {
    const { element, fixture } = await renderWithInputs(InstallationHintBanner, {
      offer: 'home-screen-steps',
    });
    const disclosure = getButton(element, 'So geht’s');
    const steps = element.querySelector('p');
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    expect(disclosure.getAttribute('aria-controls')).toBe(steps?.id);
    expect(steps?.hidden).toBe(true);
    expect(() => getButton(element, 'Installieren')).toThrow();

    disclosure.click();
    await fixture.whenStable();

    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(steps?.hidden).toBe(false);
    expect(accessibleTextOf(steps)).toBe('Tippe auf Teilen und dann auf „Zum Home-Bildschirm“.');

    disclosure.click();
    await fixture.whenStable();

    expect(steps?.hidden).toBe(true);
  });

  it('asks for the install dialog of the browser where there is one', async () => {
    const { element, fixture } = await renderWithInputs(InstallationHintBanner, {
      offer: 'install-dialog',
    });
    const installRequested = vi.fn<() => void>();
    fixture.componentInstance.installRequested.subscribe(installRequested);

    getButton(element, 'Installieren').click();

    expect(installRequested).toHaveBeenCalledOnce();
    expect(() => getButton(element, 'So geht’s')).toThrow();
  });

  it('closes on request', async () => {
    const { element, fixture } = await renderWithInputs(InstallationHintBanner, {
      offer: 'home-screen-steps',
    });
    const dismissed = vi.fn<() => void>();
    fixture.componentInstance.dismissed.subscribe(dismissed);

    getButton(element, 'Hinweis schließen').click();

    expect(dismissed).toHaveBeenCalledOnce();
  });

  it('leaves the app icon out of the accessibility tree', async () => {
    const { element } = await renderWithInputs(InstallationHintBanner, {
      offer: 'home-screen-steps',
    });

    expect(element.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
