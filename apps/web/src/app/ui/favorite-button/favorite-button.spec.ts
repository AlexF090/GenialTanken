import { TestBed } from '@angular/core/testing';
import { FavoriteButton } from './favorite-button';

const render = async (isFavorite: boolean) => {
  const fixture = TestBed.createComponent(FavoriteButton);
  fixture.componentRef.setInput('stationName', 'Aral Tankstelle');
  fixture.componentRef.setInput('isFavorite', isFavorite);
  await fixture.whenStable();
  const button = (fixture.nativeElement as HTMLElement).querySelector('button');
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
    expect(button.getAttribute('aria-label')).toBe('Zu Favoriten hinzufügen: Aral Tankstelle');
  });

  it('is pressed and offers removal for a favorite', async () => {
    const { button } = await render(true);

    expect(button.getAttribute('aria-pressed')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe('Aus Favoriten entfernen: Aral Tankstelle');
  });

  it('emits when clicked', async () => {
    const { fixture, button } = await render(false);
    const toggled = vi.fn();
    fixture.componentInstance.toggled.subscribe(toggled);

    button.click();

    expect(toggled).toHaveBeenCalledOnce();
  });
});
