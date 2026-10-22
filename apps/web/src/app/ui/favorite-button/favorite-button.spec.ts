import { renderWithInputs } from '../../../testing/render-page';
import { FavoriteButton } from './favorite-button';

const render = async (isFavorite: boolean) => {
  const { fixture, element } = await renderWithInputs(FavoriteButton, {
    stationName: 'Aral Tankstelle',
    isFavorite,
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
});
