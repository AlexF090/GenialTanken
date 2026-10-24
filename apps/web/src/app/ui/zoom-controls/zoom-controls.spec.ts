import { getButton, renderWithInputs } from '../../../testing/render-page';
import { ZoomControls } from './zoom-controls';

describe('ZoomControls', () => {
  it('groups both buttons as „Zoom“ and reports which one was pressed', async () => {
    const { fixture, element } = await renderWithInputs(ZoomControls, {
      canZoomIn: true,
      canZoomOut: true,
    });
    const requests: string[] = [];
    fixture.componentInstance.zoomInRequested.subscribe(() => requests.push('in'));
    fixture.componentInstance.zoomOutRequested.subscribe(() => requests.push('out'));

    expect(element.getAttribute('role')).toBe('group');
    expect(element.getAttribute('aria-label')).toBe('Zoom');
    getButton(element, 'Hineinzoomen').click();
    getButton(element, 'Herauszoomen').click();

    expect(requests).toEqual(['in', 'out']);
  });

  it('marks a button at the end of the range unavailable but keeps it focusable', async () => {
    const { element } = await renderWithInputs(ZoomControls, {
      canZoomIn: false,
      canZoomOut: true,
    });

    expect(getButton(element, 'Hineinzoomen').getAttribute('aria-disabled')).toBe('true');
    expect(getButton(element, 'Hineinzoomen').disabled).toBe(false);
    expect(getButton(element, 'Herauszoomen').hasAttribute('aria-disabled')).toBe(false);
  });
});
