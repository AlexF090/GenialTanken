import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import {
  CHEAPEST_PRICE_SHORT_LABEL,
  CHEAPEST_PRICE_STANDALONE_LABEL,
} from '../../core/stations/price-labels';
import type { PriceLevel } from '../../core/stations/price-level';
import { Price } from '../price/price';

/** The cheapest price is solid green, every other price tinted by its level. */
export type PriceTint = PriceLevel | 'cheapest' | 'without-price';

/**
 * A station's price on a tile tinted from cheap to dear within the prices shown, like its price
 * tag on the map. The color only repeats what the price says; the cheapest is named in words.
 */
@Component({
  selector: 'app-price-tile',
  imports: [Price],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': '"price-tile price-tile--" + tint()',
  },
  template: `
    <app-price size="list" [priceInEuro]="priceInEuro()" />
    @if (isCheapest()) {
      <span class="visually-hidden">{{ cheapestPriceLabel }}</span>
      <span class="price-tile__cheapest-label" aria-hidden="true">{{
        cheapestPriceShortLabel
      }}</span>
    }
  `,
  styleUrl: './price-tile.scss',
})
export class PriceTile {
  readonly priceInEuro = input.required<number | null>();
  readonly tint = input.required<PriceTint>();
  readonly isCheapest = input(false);

  protected readonly cheapestPriceLabel = CHEAPEST_PRICE_STANDALONE_LABEL;
  protected readonly cheapestPriceShortLabel = CHEAPEST_PRICE_SHORT_LABEL;
}
