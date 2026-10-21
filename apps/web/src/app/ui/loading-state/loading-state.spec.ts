import { TestBed } from '@angular/core/testing';
import { LoadingState } from './loading-state';

const COLD_START_HINT =
  'Der Server wird gerade gestartet. Das kann beim ersten Aufruf bis zu einer Minute dauern.';

describe('LoadingState', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const render = (isLoading: boolean) => {
    const fixture = TestBed.createComponent(LoadingState);
    fixture.componentRef.setInput('isLoading', isLoading);
    fixture.detectChanges();
    return fixture;
  };

  it('announces loading in a status region', () => {
    const fixture = render(true);
    const status = (fixture.nativeElement as HTMLElement).querySelector('[role="status"]');

    expect(status?.textContent).toContain('Tankstellen werden geladen …');
    expect(status?.textContent).not.toContain(COLD_START_HINT);
  });

  it('mentions the waking server after a few seconds of loading', () => {
    const fixture = render(true);

    vi.advanceTimersByTime(4000);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(COLD_START_HINT);
  });

  it('shows nothing once loading is done', () => {
    const fixture = render(true);
    vi.advanceTimersByTime(4000);

    fixture.componentRef.setInput('isLoading', false);
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent.trim()).toBe('');
  });
});
