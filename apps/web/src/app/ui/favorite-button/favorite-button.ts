import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { Icon } from '../icon/icon';

@Component({
  selector: 'app-favorite-button',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <button
      type="button"
      class="favorite-button"
      [attr.aria-pressed]="isFavorite()"
      [attr.aria-label]="accessibleName()"
      (click)="toggled.emit()">
      <app-icon [name]="isFavorite() ? 'star' : 'star-outline'" />
    </button>
  `,
  styleUrl: './favorite-button.scss',
})
export class FavoriteButton {
  readonly stationName = input.required<string>();
  readonly isFavorite = input.required<boolean>();
  readonly toggled = output();

  protected readonly accessibleName = computed(() =>
    this.isFavorite()
      ? `Aus Favoriten entfernen: ${this.stationName()}`
      : `Zu Favoriten hinzufügen: ${this.stationName()}`
  );
}
