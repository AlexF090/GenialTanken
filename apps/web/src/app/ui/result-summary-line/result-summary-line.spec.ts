import {
  accessibleTextOf,
  getButton,
  renderWithInputs,
  textOf,
} from '../../../testing/render-page';
import { ResultSummaryLine } from './result-summary-line';

const SUMMARY = '4 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris';

const render = () =>
  renderWithInputs(ResultSummaryLine, { summary: SUMMARY, briefSummary: '4 Tankstellen · 5 km' });

describe('ResultSummaryLine', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows the brief summary and announces the whole sentence', async () => {
    const { element } = await render();

    expect(textOf(element.querySelector('[aria-hidden="true"]'))).toBe('4 Tankstellen · 5 km');
    expect(textOf(element.querySelector('[role="status"]'))).toBe(SUMMARY);
    expect(accessibleTextOf(element)).toBe(SUMMARY);
  });

  it('shows the sentence itself, once, when there is no brief summary', async () => {
    const message = 'Keine Tankstellen mit Preis für E5 im Umkreis von 5 km gefunden.';
    const { element } = await renderWithInputs(ResultSummaryLine, {
      summary: message,
      briefSummary: message,
    });

    const status = element.querySelector('[role="status"]');
    expect(textOf(status)).toBe(message);
    expect(status?.classList).not.toContain('visually-hidden');
    expect(textOf(element)).toBe(message);
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

    expect(document.activeElement).toBe(element.querySelector('[role="status"]'));
  });
});
