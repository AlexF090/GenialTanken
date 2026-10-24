import { TestBed } from '@angular/core/testing';
import type { ComponentFixture } from '@angular/core/testing';
import {
  accessibleTextOf,
  getButton,
  hostElementOf,
  renderWithInputs,
  textOf,
} from '../../../testing/render-page';
import {
  COLD_START_HINT,
  COLD_START_HINT_DELAY_IN_MILLISECONDS,
} from '../../core/api-wake-up/cold-start-hint';
import {
  LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS,
  ResultSummaryLine,
} from './result-summary-line';

const SUMMARY = '4 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris';
const BRIEF_SUMMARY = '4 Tankstellen · 5 km';
const LOADING_MESSAGE = 'Tankstellen werden geladen …';

const render = (isLoading = false) =>
  renderWithInputs(ResultSummaryLine, {
    summary: SUMMARY,
    briefSummary: BRIEF_SUMMARY,
    isLoading,
  });

const statusOf = (element: HTMLElement) => element.querySelector('[role="status"]');
const shownLineOf = (element: HTMLElement) => element.querySelector('.result-summary-line__text');

/** Renders synchronously, so fake timers decide when the delays run out. */
const renderWithFakeTimers = (inputs: {
  summary: string;
  briefSummary: string;
  isLoading: boolean;
}): { fixture: ComponentFixture<ResultSummaryLine>; element: HTMLElement } => {
  vi.useFakeTimers();
  const fixture = TestBed.createComponent(ResultSummaryLine);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  return { fixture, element: hostElementOf(fixture) };
};

const advance = (fixture: ComponentFixture<ResultSummaryLine>, milliseconds: number) => {
  vi.advanceTimersByTime(milliseconds);
  fixture.detectChanges();
};

const finishLoading = (fixture: ComponentFixture<ResultSummaryLine>, summary = SUMMARY) => {
  fixture.componentRef.setInput('isLoading', false);
  fixture.componentRef.setInput('summary', summary);
  fixture.componentRef.setInput('briefSummary', BRIEF_SUMMARY);
  fixture.detectChanges();
};

describe('ResultSummaryLine', () => {
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('shows the brief summary and announces the whole sentence', async () => {
    const { element } = await render();

    expect(textOf(shownLineOf(element))).toBe(BRIEF_SUMMARY);
    expect(shownLineOf(element)?.getAttribute('aria-hidden')).toBe('true');
    expect(textOf(statusOf(element))).toBe(SUMMARY);
    expect(accessibleTextOf(element)).toBe(SUMMARY);
  });

  it('shows the sentence itself when there is no brief summary, and reads it once', async () => {
    const message = 'Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.';
    const { element } = await renderWithInputs(ResultSummaryLine, {
      summary: message,
      briefSummary: message,
    });

    expect(textOf(shownLineOf(element))).toBe(message);
    expect(accessibleTextOf(element)).toBe(message);
  });

  it('asks for fresh prices with a button named "Aktualisieren"', async () => {
    const { element, fixture } = await render();
    const refreshRequested = vi.fn<() => void>();
    fixture.componentInstance.refreshRequested.subscribe(refreshRequested);

    getButton(element, 'Aktualisieren').click();

    expect(refreshRequested).toHaveBeenCalledOnce();
  });

  it('moves the focus to the announced sentence on request', async () => {
    const { element, fixture } = await render();
    document.body.append(element);

    fixture.componentInstance.focusSummary();

    expect(document.activeElement).toBe(statusOf(element));
  });

  it('shows loading at once while nothing has loaded yet, but announces it only when it lasts', () => {
    const { element, fixture } = renderWithFakeTimers({
      summary: '',
      briefSummary: '',
      isLoading: true,
    });

    expect(textOf(shownLineOf(element))).toBe(LOADING_MESSAGE);
    expect(textOf(statusOf(element))).toBe('');

    advance(fixture, LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS - 1);
    expect(textOf(statusOf(element))).toBe('');

    advance(fixture, 1);
    expect(textOf(statusOf(element))).toBe(LOADING_MESSAGE);
  });

  it('announces only the result of a quick answer', () => {
    const { element, fixture } = renderWithFakeTimers({
      summary: SUMMARY,
      briefSummary: BRIEF_SUMMARY,
      isLoading: true,
    });
    const announcements = new Set<string>();
    const observer = new MutationObserver(() => {
      announcements.add(textOf(statusOf(element)));
    });
    const status = statusOf(element);
    if (status === null) {
      throw new Error('ResultSummaryLine rendered no status');
    }
    observer.observe(status, { childList: true, characterData: true, subtree: true });

    advance(fixture, LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS / 2);
    finishLoading(fixture);
    advance(fixture, LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS);

    expect(textOf(status)).toBe(SUMMARY);
    expect(announcements).not.toContain(LOADING_MESSAGE);
    observer.disconnect();
  });

  it('keeps the shown result while reloading and announces a lasting reload', () => {
    const { element, fixture } = renderWithFakeTimers({
      summary: SUMMARY,
      briefSummary: BRIEF_SUMMARY,
      isLoading: true,
    });

    advance(fixture, LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS);

    expect(textOf(shownLineOf(element))).toBe(BRIEF_SUMMARY);
    expect(accessibleTextOf(element)).toBe(LOADING_MESSAGE);

    finishLoading(fixture);
    expect(textOf(statusOf(element))).toBe(SUMMARY);
  });

  it('keeps the busy refresh button focusable and named, but ignores presses', async () => {
    const { element, fixture } = await render(true);
    const refreshRequested = vi.fn<() => void>();
    fixture.componentInstance.refreshRequested.subscribe(refreshRequested);

    const refreshButton = getButton(element, 'Aktualisieren');
    refreshButton.click();

    expect(refreshButton.getAttribute('aria-disabled')).toBe('true');
    expect(refreshButton.disabled).toBe(false);
    expect(refreshRequested).not.toHaveBeenCalled();
  });

  it('does not mark the idle refresh button as disabled', async () => {
    const { element } = await render();

    expect(getButton(element, 'Aktualisieren').hasAttribute('aria-disabled')).toBe(false);
  });

  it.each([
    ['the first load', '', ''],
    ['a reload', SUMMARY, BRIEF_SUMMARY],
  ])(
    'mentions the waking server after a few seconds of %s, visibly in place of the line',
    (_, summary, briefSummary) => {
      const { element, fixture } = renderWithFakeTimers({ summary, briefSummary, isLoading: true });

      advance(fixture, COLD_START_HINT_DELAY_IN_MILLISECONDS);

      expect(textOf(statusOf(element))).toBe(`${LOADING_MESSAGE} ${COLD_START_HINT}`);
      // One line in place of the summary, so the header keeps its height and the sheet stays put.
      expect(textOf(shownLineOf(element))).toBe(COLD_START_HINT);
      expect(shownLineOf(element)?.classList).toContain('result-summary-line__text--hint');
      expect(accessibleTextOf(element)).toBe(`${LOADING_MESSAGE} ${COLD_START_HINT}`);

      finishLoading(fixture);
      expect(textOf(statusOf(element))).toBe(SUMMARY);
      expect(textOf(shownLineOf(element))).toBe(BRIEF_SUMMARY);
    }
  );
});
