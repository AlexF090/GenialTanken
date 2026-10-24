import { renderComponent } from '../../../testing/render-page';
import { BrowserEdgeTint } from './browser-edge-tint';

describe('BrowserEdgeTint', () => {
  it('renders a strip at the top and one at the bottom, both hidden from assistive technology', async () => {
    const { element } = await renderComponent(BrowserEdgeTint);

    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.browser-edge-tint--top')).not.toBeNull();
    expect(element.querySelector('.browser-edge-tint--bottom')).not.toBeNull();
  });
});
