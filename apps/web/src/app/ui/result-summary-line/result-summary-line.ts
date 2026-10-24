import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { Icon } from '../icon/icon';
import { COLD_START_HINT, injectShowsColdStartHint } from '../../core/api-wake-up/cold-start-hint';
import { injectHasLastedFor } from '../../core/time/has-lasted-for';

const LOADING_MESSAGE = 'Tankstellen werden geladen …';

/** Quicker answers, cached ones too, are announced by their result alone. */
export const LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS = 700;

/**
 * The line under the filters: a brief summary such as "4 Tankstellen · 5 km" and a refresh
 * button at its end, so a wrapped line (large text, an empty result) never strands the button.
 * Screen readers get the whole sentence instead, announced as a status; it is also where the
 * focus returns to, which then rings the visible line. The button's touch target reaches into
 * the gaps above and below, as far as the filter chips' do, so the line is no taller than they.
 * It is the app's only loading indicator: the refresh icon turns at once while stations load and
 * the shown result stays; the status says „Tankstellen werden geladen …“ only once loading lasts,
 * until the result replaces it. When the sleeping server keeps it waiting, the line shows the
 * cold start hint in its place, on one line, so the header keeps its height and the sheet does
 * not move; the status reads the whole hint.
 */
@Component({
  selector: 'app-result-summary-line',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Shown itself where it says what the line shows, so it is in the page once. -->
    <p
      #summaryElement
      class="result-summary-line__summary"
      role="status"
      tabindex="-1"
      [class.visually-hidden]="isBrief()"
      [class.result-summary-line__text]="!isBrief()">
      {{ announcement() }}
    </p>
    @if (isBrief()) {
      <span
        class="result-summary-line__text"
        aria-hidden="true"
        [class.result-summary-line__text--hint]="showsColdStartHint()"
        >{{ shownText() }}</span
      >
    }
    <!-- Busy, not disabled: it keeps the focus of whoever just pressed it. -->
    <button
      type="button"
      class="icon-button result-summary-line__refresh"
      aria-label="Aktualisieren"
      [class.result-summary-line__refresh--busy]="isLoading()"
      [attr.aria-disabled]="isLoading() || null"
      (click)="requestRefresh()">
      <app-icon name="refresh" />
    </button>
  `,
  styles: `
    @use 'focus-ring';

    :host {
      display: flex;
      gap: var(--space-xs);
      align-items: center;
      justify-content: space-between;
      min-height: var(--layout-chip-height);
      color: var(--color-text-secondary);
      font-size: var(--font-size-subheadline);
    }

    .result-summary-line__summary:focus-visible + .result-summary-line__text {
      @include focus-ring.focus-ring;
    }

    // The brief summary keeps its parts together (non-breaking spaces); only a line too narrow
    // for it breaks anywhere.
    .result-summary-line__text {
      min-width: 0;
      border-radius: var(--radius-sm);
      overflow-wrap: anywhere;
    }

    .result-summary-line__text--hint {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    .result-summary-line__refresh {
      margin-block: calc(-1 * var(--layout-chip-overhang));
    }

    // Looks disabled and ignores hover and presses; the icon turns, or stands still without motion.
    .result-summary-line__refresh--busy {
      cursor: progress;
      opacity: var(--opacity-disabled);

      app-icon {
        animation: turn var(--duration-spin) linear infinite;

        @media (prefers-reduced-motion: reduce) {
          animation: none;
        }
      }
    }

    @keyframes turn {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class ResultSummaryLine {
  /** The whole sentence, e.g. "4 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris". */
  readonly summary = input.required<string>();
  /** What the line shows, e.g. "4 Tankstellen · 5 km"; the same as `summary` to show that. */
  readonly briefSummary = input.required<string>();
  /** Stations are loading, the first time or again. */
  readonly isLoading = input(false);
  readonly refreshRequested = output();

  protected readonly showsColdStartHint = injectShowsColdStartHint(this.isLoading);
  private readonly announcesLoading = injectHasLastedFor(
    this.isLoading,
    LOADING_ANNOUNCEMENT_DELAY_IN_MILLISECONDS
  );

  /** Empty while loading has not lasted yet, so the result that follows is announced anew. */
  protected readonly announcement = computed(() => {
    if (!this.isLoading()) {
      return this.summary();
    }
    if (!this.announcesLoading()) {
      return '';
    }
    return this.showsColdStartHint() ? `${LOADING_MESSAGE} ${COLD_START_HINT}` : LOADING_MESSAGE;
  });
  /** A reload keeps the result in view. */
  protected readonly shownText = computed(() => {
    if (this.showsColdStartHint()) {
      return COLD_START_HINT;
    }
    return this.briefSummary() || (this.isLoading() ? LOADING_MESSAGE : this.summary());
  });

  protected readonly isBrief = computed(() => this.shownText() !== this.announcement());

  private readonly summaryElement = viewChild.required<ElementRef<HTMLElement>>('summaryElement');

  protected requestRefresh(): void {
    if (this.isLoading()) {
      return;
    }
    this.refreshRequested.emit();
  }

  focusSummary(): void {
    this.summaryElement().nativeElement.focus({ preventScroll: true });
  }
}
