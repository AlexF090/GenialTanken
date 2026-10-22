import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

/** `icon` in a list row, `tile` in the action row of a station card. */
export type FavoriteButtonAppearance = 'icon' | 'tile';

@Component({
  selector: 'app-favorite-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      [class]="appearance() === 'tile' ? 'action-tile' : 'icon-button icon-button--row-action'"
      [attr.aria-pressed]="isFavorite()"
      [attr.aria-label]="accessibleName()"
      (click)="toggled.emit()">
      <app-icon [name]="isFavorite() ? 'star' : 'star-outline'" />
      @if (appearance() === 'tile') {
        <span class="action-tile__label" aria-hidden="true">Favorit</span>
      }
    </button>
  `,
  styles: `
    :host {
      display: contents;
    }
  `,
})
export class FavoriteButton {
  readonly stationName = input.required<string>();
  readonly isFavorite = input.required<boolean>();
  readonly appearance = input<FavoriteButtonAppearance>('icon');
  readonly toggled = output();

  /** Stays constant; the favorite state is conveyed by `aria-pressed`. */
  protected readonly accessibleName = computed(() => `Favorit: ${this.stationName()}`);
}
