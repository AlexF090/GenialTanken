import {
  accessibleTextOf,
  getButton,
  renderWithInputs,
  textOf,
} from '../../../testing/render-page';
import { InstallationHintCard } from './installation-hint-card';

describe('InstallationHintCard', () => {
  it('is a region named by its heading', async () => {
    const { element } = await renderWithInputs(InstallationHintCard, {
      offer: 'home-screen-steps',
    });

    const region = element.querySelector('section');
    const heading = element.querySelector('h2');
    expect(textOf(heading)).toBe('GenialTanken als App');
    expect(region?.getAttribute('aria-labelledby')).toBe(heading?.id);
  });

  it('explains the steps of iOS without an install button', async () => {
    const { element } = await renderWithInputs(InstallationHintCard, {
      offer: 'home-screen-steps',
    });

    expect(accessibleTextOf(element.querySelector('p'))).toBe(
      'Tippe auf Teilen und dann auf „Zum Home-Bildschirm“.'
    );
    expect(() => getButton(element, 'Installieren')).toThrow();
  });

  it('asks for the install dialog of the browser where there is one', async () => {
    const { element, fixture } = await renderWithInputs(InstallationHintCard, {
      offer: 'install-dialog',
    });
    const installRequested = vi.fn<() => void>();
    fixture.componentInstance.installRequested.subscribe(installRequested);

    getButton(element, 'Installieren').click();

    expect(installRequested).toHaveBeenCalledOnce();
  });

  it('closes on request', async () => {
    const { element, fixture } = await renderWithInputs(InstallationHintCard, {
      offer: 'home-screen-steps',
    });
    const dismissed = vi.fn<() => void>();
    fixture.componentInstance.dismissed.subscribe(dismissed);

    getButton(element, 'Hinweis schließen').click();

    expect(dismissed).toHaveBeenCalledOnce();
  });

  it('leaves the app icon out of the accessibility tree', async () => {
    const { element } = await renderWithInputs(InstallationHintCard, {
      offer: 'home-screen-steps',
    });

    expect(element.querySelector('img')?.getAttribute('alt')).toBe('');
  });
});
