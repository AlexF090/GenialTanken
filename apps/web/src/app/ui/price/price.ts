import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatPrice, formatPriceParts } from '../../core/formatting/number-format';

/**
 * "1,85⁹ €" — German price with the tenth of a cent raised like on a price board.
 * Screen readers get the plain "1,859 €" instead of the split digits.
 */
@Component({
  selector: 'app-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="visually-hidden">{{ plainPrice() }}</span
    ><span aria-hidden="true"
      >{{ parts().leadingDigits }}<sup>{{ parts().tenthOfCent }}</sup> €</span
    >`,
  styles: `
    :host {
      white-space: nowrap;
    }
  `,
})
export class Price {
  readonly priceInEuro = input.required<number>();

  protected readonly plainPrice = computed(() => formatPrice(this.priceInEuro()));
  protected readonly parts = computed(() => formatPriceParts(this.priceInEuro()));
}
