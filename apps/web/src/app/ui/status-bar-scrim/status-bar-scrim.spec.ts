import { renderWithInputs } from '../../../testing/render-page';
import { StatusBarScrim } from './status-bar-scrim';

describe('StatusBarScrim', () => {
  it('is decorative and hidden from assistive technology', async () => {
    const { element } = await renderWithInputs(StatusBarScrim, {});

    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.childElementCount).toBe(0);
    expect(element.textContent).toBe('');
  });
});
