import { getButton, renderWithInputs } from '../../../testing/render-page';
import { CloseButton } from './close-button';

describe('CloseButton', () => {
  it('is a button named by its label, with the cross drawn in a grey circle', async () => {
    const { element } = await renderWithInputs(CloseButton, { label: 'Hinweis schließen' });

    const button = getButton(element, 'Hinweis schließen');
    expect(button.type).toBe('button');
    expect(button.classList).toContain('icon-button--circled');
    expect(button.querySelector(':scope > .icon-button__circle app-icon')).not.toBeNull();
  });

  it('is named „Schließen“ by default', async () => {
    const { element } = await renderWithInputs(CloseButton, {});

    expect(getButton(element, 'Schließen')).toBeDefined();
  });

  it('reports a press', async () => {
    const { fixture, element } = await renderWithInputs(CloseButton, {});
    const pressed = vi.fn();
    fixture.componentInstance.pressed.subscribe(pressed);

    getButton(element, 'Schließen').click();

    expect(pressed).toHaveBeenCalledOnce();
  });
});
