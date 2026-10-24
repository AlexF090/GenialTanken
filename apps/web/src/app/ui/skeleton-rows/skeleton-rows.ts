import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * `station`: a row of the station list (price tile, two lines, room for star and ⓘ); `text`: two
 * lines only; `price`: a row of the station card's price board (fuel at the start, price at the
 * end); `tile`: small cards side by side, like the favorites row.
 */
export type SkeletonRowsVariant = 'station' | 'text' | 'price' | 'tile';

/**
 * Grey placeholders (`.skeleton-block`) in the shape of content still loading for the first time,
 * so it takes their place without moving anything. Purely decorative: the loading state is
 * announced as text elsewhere, so screen readers skip them.
 */
@Component({
  selector: 'app-skeleton-rows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[class]': "'skeleton-rows skeleton-rows--' + variant()" },
  template: `
    @for (row of rows(); track row) {
      @switch (variant()) {
        @case ('tile') {
          <div class="skeleton-rows__card">
            <span class="skeleton-block skeleton-rows__card-title"></span>
            <span class="skeleton-block skeleton-rows__card-price"></span>
            <span class="skeleton-block skeleton-rows__card-distance"></span>
          </div>
        }
        @case ('price') {
          <div class="skeleton-rows__price-row">
            <span class="skeleton-block skeleton-rows__fuel"></span>
            <span class="skeleton-block skeleton-rows__price-end"></span>
          </div>
        }
        @default {
          <div class="skeleton-rows__row">
            @if (variant() === 'station') {
              <span class="skeleton-block skeleton-rows__tile"></span>
            }
            <span class="skeleton-rows__lines">
              <span class="skeleton-block skeleton-rows__line skeleton-rows__line--title"></span>
              <span
                class="skeleton-block skeleton-rows__line skeleton-rows__line--secondary"></span>
            </span>
            @if (variant() === 'station') {
              <span class="skeleton-rows__actions"></span>
            }
          </div>
        }
      }
    }
  `,
  styleUrl: './skeleton-rows.scss',
})
export class SkeletonRows {
  readonly count = input(3);
  readonly variant = input<SkeletonRowsVariant>('station');

  protected readonly rows = computed(() =>
    Array.from({ length: this.count() }, (_, index) => index)
  );
}
