import { TestBed } from '@angular/core/testing';
import { renderWithInputs, textOf } from '../../../testing/render-page';
import { FavoriteButton } from './favorite-button';
import type { FavoriteButtonAppearance } from './favorite-button';

const render = async (isFavorite: boolean, appearance: FavoriteButtonAppearance = 'icon') => {
  const { fixture, element } = await renderWithInputs(FavoriteButton, {
    stationName: 'Aral Tankstelle',
    isFavorite,
    appearance,
  });
  const button = element.querySelector('button');
  if (button === null) {
    throw new Error('FavoriteButton rendered no button');
  }
  return { fixture, button };
};

describe('FavoriteButton', () => {
  it('is an unpressed toggle button named after the station', async () => {
    const { button } = await render(false);

    expect(button.type).toBe('button');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Favorit: Aral Tankstelle');
  });

  it('keeps its name and only changes the pressed state for a favorite', async () => {
    const { button } = await render(true);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Favorit: Aral Tankstelle');
  });

  it('emits when clicked', async () => {
    const { fixture, button } = await render(false);
    const toggled = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggled);

    button.click();

    expect(toggled).toHaveBeenCalledOnce();
  });

  it('shows only the star in a row and "Favorit" below it as a tile', async () => {
    expect(textOf((await render(false)).button)).toBe('');
    TestBed.resetTestingModule();
    const { button } = await render(true, 'tile');

    expect(textOf(button)).toBe('Favorit');
    expect(button.getAttribute('aria-label')).toBe('Favorit: Aral Tankstelle');
  });
});
