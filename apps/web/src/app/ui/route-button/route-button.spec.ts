import { TestBed } from '@angular/core/testing';
import { OPEN_EXTERNAL_URL } from '../../core/navigation-apps/open-external-url';
import { renderWithInputs, textOf } from '../../../testing/render-page';
import { RouteButton } from './route-button';

const render = async (isLabelled = false) => {
  const openedUrls: string[] = [];
  const { element } = await renderWithInputs(
    RouteButton,
    { destination: { latitude: 48.8532, longitude: 2.3692, name: 'TotalEnergies' }, isLabelled },
    [{ provide: OPEN_EXTERNAL_URL, useValue: (url: string) => openedUrls.push(url) }]
  );
  const select = element.querySelector('select');
  if (select === null) {
    throw new Error('No select');
  }
  const choose = (value: string) => {
    select.value = value;
    select.dispatchEvent(new Event('change'));
  };
  return { element, select, choose, openedUrls };
};

describe('RouteButton', () => {
  it('is a native choice named after the destination', async () => {
    const { select } = await render();

    expect(select.getAttribute('aria-label')).toBe('Route zu TotalEnergies');
    expect([...select.options].map(option => textOf(option))).toEqual([
      'Route starten mit …',
      'Apple Karten',
      'Google Maps',
      'Waze',
    ]);
    expect(select.value).toBe('');
  });

  it('opens the route in the chosen app and returns to the prompt', async () => {
    const { select, choose, openedUrls } = await render();

    choose('google-maps');
    choose('google-maps');

    expect(openedUrls).toEqual([
      'https://www.google.com/maps/dir/?api=1&destination=48.8532%2C2.3692&travelmode=driving',
      'https://www.google.com/maps/dir/?api=1&destination=48.8532%2C2.3692&travelmode=driving',
    ]);
    expect(select.value).toBe('');
  });

  it('shows "Route" next to the icon only when labelled', async () => {
    expect((await render()).element.querySelector('.route-button__label')).toBeNull();
    TestBed.resetTestingModule();
    expect(textOf((await render(true)).element.querySelector('.route-button__label'))).toBe(
      'Route'
    );
  });
});
