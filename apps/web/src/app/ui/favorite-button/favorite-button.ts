import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-favorite-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="icon-button icon-button--row-action"
      [attr.aria-pressed]="isFavorite()"
      [attr.aria-label]="accessibleName()"
      (click)="toggled.emit()">
      <app-icon [name]="isFavorite() ? 'star' : 'star-outline'" />
    </button>
  `,
})
export class FavoriteButton {
  readonly stationName = input.required<string>();
  readonly isFavorite = input.required<boolean>();
  readonly toggled = output();

  /** Stays constant; the favorite state is conveyed by `aria-pressed`. */
  protected readonly accessibleName = computed(() => `Favorit: ${this.stationName()}`);
}
