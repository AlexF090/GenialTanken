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

/**
 * The line under the filters: a brief summary such as "4 Tankstellen · 5 km" and a refresh
 * button at its end, so a wrapped line (large text, an empty result) never strands the button.
 * Screen readers get the whole sentence instead, announced as a status; it is also where the
 * focus returns to, which then rings the visible line. The button's touch target reaches into
 * the gaps above and below, as far as the filter chips' do, so the line is no taller than they.
 */
@Component({
  selector: 'app-result-summary-line',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <p
      #summaryElement
      class="result-summary-line__summary"
      role="status"
      tabindex="-1"
      [class.visually-hidden]="isBrief()">
      {{ summary() }}
    </p>
    @if (isBrief()) {
      <span class="result-summary-line__text" aria-hidden="true">{{ briefSummary() }}</span>
    }
    <button
      type="button"
      class="icon-button result-summary-line__refresh"
      aria-label="Aktualisieren"
      (click)="refreshRequested.emit()">
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

    .result-summary-line__text {
      border-radius: var(--radius-sm);
    }

    .result-summary-line__refresh {
      margin-block: calc(-1 * var(--layout-chip-overhang));
    }
  `,
})
export class ResultSummaryLine {
  /** The whole sentence, e.g. "4 Tankstellen im Umkreis von 5 km um Eiffelturm, Paris". */
  readonly summary = input.required<string>();
  /** What the line shows, e.g. "4 Tankstellen · 5 km"; the same as `summary` to show that. */
  readonly briefSummary = input.required<string>();
  readonly refreshRequested = output();

  protected readonly isBrief = computed(() => this.briefSummary() !== this.summary());

  private readonly summaryElement = viewChild.required<ElementRef<HTMLElement>>('summaryElement');

  focusSummary(): void {
    this.summaryElement().nativeElement.focus({ preventScroll: true });
  }
}
