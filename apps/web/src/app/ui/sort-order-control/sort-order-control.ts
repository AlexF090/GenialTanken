import { ChangeDetectionStrategy, Component, model } from '@angular/core';
import type { SortOrder } from '../../core/stations/sort-stations';

interface SortOrderOption {
  value: SortOrder;
  label: string;
}

const SORT_ORDER_OPTIONS: readonly SortOrderOption[] = [
  { value: 'distance', label: 'Entfernung' },
  { value: 'price', label: 'Preis' },
];

let nextIdentifier = 0;

/** Segmented control built from native radio buttons, so arrow keys and announcements work. */
@Component({
  selector: 'app-sort-order-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="sort-order-control">
      <legend class="visually-hidden">Sortierung</legend>
      @for (option of options; track option.value) {
        <label class="sort-order-control__option">
          <input
            type="radio"
            class="sort-order-control__radio"
            [name]="groupName"
            [value]="option.value"
            [checked]="sortOrder() === option.value"
            (change)="sortOrder.set(option.value)" />
          {{ option.label }}
        </label>
      }
    </fieldset>
  `,
  styleUrl: './sort-order-control.scss',
})
export class SortOrderControl {
  readonly sortOrder = model.required<SortOrder>();

  protected readonly options = SORT_ORDER_OPTIONS;
  protected readonly groupName = `sort-order-${String(nextIdentifier++)}`;
}
