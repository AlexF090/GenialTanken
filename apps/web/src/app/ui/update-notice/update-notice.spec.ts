import { renderWithInputs } from '../../../testing/render-page';
import { UpdateNotice } from './update-notice';

/**
 * The `display` of the last author rule that matches the element. Browsers let any author rule
 * beat the user agent's `[hidden] { display: none }`; jsdom's computed style does not, so it
 * cannot show the difference.
 */
const lastAuthorDisplayOf = (element: Element): string | undefined => {
  let display: string | undefined;
  for (const styleSheet of Array.from(document.styleSheets)) {
    for (const rule of Array.from(styleSheet.cssRules)) {
      if (
        rule instanceof CSSStyleRule &&
        element.matches(rule.selectorText) &&
        rule.style.display !== ''
      ) {
        display = rule.style.display;
      }
    }
  }
  return display;
};

describe('UpdateNotice', () => {
  it('stays hidden with the hidden attribute', async () => {
    const { element } = await renderWithInputs(UpdateNotice, { pendingReload: 'update-ready' });

    element.hidden = true;

    expect(lastAuthorDisplayOf(element)).toBe('none');
  });

  it('shows the notice without the hidden attribute', async () => {
    const { element } = await renderWithInputs(UpdateNotice, { pendingReload: 'update-ready' });

    expect(lastAuthorDisplayOf(element)).toBe('block');
    expect(element.querySelector('[role="status"] p')?.textContent).toBe('Neue Version verfügbar');
  });

  it('keeps the status region empty without a pending reload', async () => {
    const { element } = await renderWithInputs(UpdateNotice, { pendingReload: undefined });

    expect(element.querySelector('[role="status"]')?.textContent.trim()).toBe('');
  });

  it('asks for a reload by hand once the broken cache could not be repaired', async () => {
    const { fixture, element } = await renderWithInputs(UpdateNotice, {
      pendingReload: 'reload-required',
    });
    const reloadRequested = vi.fn();
    fixture.componentInstance.reloadRequested.subscribe(reloadRequested);

    expect(element.querySelector('[role="status"] p')?.textContent).toBe(
      'Die App muss neu geladen werden.'
    );
    const button = element.querySelector<HTMLButtonElement>('[role="status"] button');
    expect(button?.textContent.trim()).toBe('Neu laden');
    button?.click();
    expect(reloadRequested).toHaveBeenCalledOnce();
  });
});
