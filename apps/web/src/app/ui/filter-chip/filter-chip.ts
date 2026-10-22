import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { LabeledOption } from '../../core/labeled-option';
import { Icon } from '../icon/icon';
import { SelectMenu } from '../select-menu/select-menu';

/**
 * Grey capsule in the filter row of the sheet, like the filter buttons of Apple Maps: shows the
 * current choice and opens a menu of the options. Its accessible name is "<label>: <face>", e.g.
 * "Kraftstoff: E5", so it contains the visible text.
 */
@Component({
  selector: 'app-filter-chip',
  imports: [Icon, SelectMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-select-menu
      class="filter-chip"
      [label]="label()"
      [options]="options()"
      [value]="value()"
      (valueChange)="valueChange.emit($event)">
      <span class="visually-hidden">{{ label() }}: </span>{{ face() }}
      <app-icon name="chevron-down" class="filter-chip__chevron" />
    </app-select-menu>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      scroll-snap-align: start;
    }

    .filter-chip {
      padding-inline: var(--space-sm) var(--space-xs);
      border-radius: var(--radius-pill);
      background-color: var(--color-search-field);
      color: var(--color-text);
      font-size: var(--font-size-subheadline);
      font-weight: var(--font-weight-medium);
      line-height: var(--line-height-tight);
      white-space: nowrap;
    }

    .filter-chip__chevron {
      color: var(--color-text-secondary);
      font-size: var(--icon-size-sm);
    }
  `,
})
export class FilterChip<T> {
  /** Names the filter and its menu, e.g. "Kraftstoff". */
  readonly label = input.required<string>();
  readonly options = input.required<readonly LabeledOption<T>[]>();
  readonly value = input.required<T>();
  /** Visible text of the chip: the current choice, e.g. "E5". */
  readonly face = input.required<string>();

  readonly valueChange = output<T>();
}
