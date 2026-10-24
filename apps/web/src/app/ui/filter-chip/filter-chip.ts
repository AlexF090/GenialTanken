import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import type { LabeledOption } from '../../core/labeled-option';
import { Icon } from '../icon/icon';
import { SelectMenu } from '../select-menu/select-menu';

/**
 * Grey capsule in the filter row of the sheet, like the filter buttons of Apple Maps: shows the
 * current choice and opens a menu of the options. Its accessible name is "<label>: <face>", e.g.
 * "Kraftstoff: E5", so it contains the visible text. The capsule is `--layout-chip-height` tall,
 * its button the full touch target; rows of chips overlap their surroundings by
 * `--layout-chip-overhang` above and below.
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

    /* The capsule is drawn smaller than the button, whose touch target keeps 44 px (2.5.5). */
    .filter-chip {
      position: relative;
      isolation: isolate;
      padding-inline: var(--space-sm) var(--space-xs);
      color: var(--color-text);
      font-size: var(--font-size-subheadline);
      font-weight: var(--font-weight-medium);
      line-height: var(--line-height-tight);
      white-space: nowrap;
    }

    .filter-chip::before {
      position: absolute;
      inset: var(--layout-chip-overhang) 0;
      z-index: var(--layer-behind-parent);
      border-radius: var(--radius-pill);
      background-color: var(--color-search-field);
      background-image: var(--gradient-control-sheen);
      box-shadow: var(--shadow-control);
      content: '';
    }

    /* Sinks while pressed, like every raised control (pressed-control in styles.scss) */
    .filter-chip:has(:active)::before {
      box-shadow: var(--shadow-control-pressed);
      transform: translateY(var(--border-width-hairline));
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
