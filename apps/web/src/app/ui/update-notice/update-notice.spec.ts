import type { PendingReload } from '../../core/application-update/application-update-store';
import { TestBed } from '@angular/core/testing';
import { hostElementOf } from '../../../testing/render-page';
import { LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS, UpdateNotice } from './update-notice';

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

/**
 * Renders the notice synchronously with fake timers (`whenStable` would wait for the faked
 * scheduler), so the test decides when the status region is filled.
 */
const render = (pendingReload: PendingReload | undefined) => {
  vi.useFakeTimers();
  const fixture = TestBed.createComponent(UpdateNotice);
  fixture.componentRef.setInput('pendingReload', pendingReload);
  TestBed.tick();
  return { fixture, element: hostElementOf(fixture) };
};

const renderAnnounced = (pendingReload: PendingReload | undefined) => {
  const rendered = render(pendingReload);
  vi.advanceTimersByTime(LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS);
  TestBed.tick();
  return rendered;
};

describe('UpdateNotice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('stays hidden with the hidden attribute', () => {
    const { element } = renderAnnounced('update-ready');

    element.hidden = true;

    expect(lastAuthorDisplayOf(element)).toBe('none');
  });

  it('shows the notice without the hidden attribute', () => {
    const { element } = renderAnnounced('update-ready');

    expect(lastAuthorDisplayOf(element)).toBe('block');
    expect(element.querySelector('[role="status"] p')?.textContent).toBe('Neue Version verfügbar');
  });

  it('keeps the status region empty without a pending reload', () => {
    const { element } = renderAnnounced(undefined);

    expect(element.querySelector('[role="status"]')?.textContent.trim()).toBe('');
  });

  it('fills its status region a moment after rendering it, so screen readers announce a notice already pending', () => {
    const { element } = render('update-ready');
    const region = element.querySelector('[role="status"]');

    expect(region?.textContent.trim()).toBe('');

    vi.advanceTimersByTime(LIVE_REGION_REGISTRATION_DELAY_IN_MILLISECONDS);
    TestBed.tick();

    expect(region?.querySelector('p')?.textContent).toBe('Neue Version verfügbar');
  });

  it('asks for a reload by hand once the broken cache could not be repaired', () => {
    const { fixture, element } = renderAnnounced('reload-required');
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
