import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatPrice, formatPriceParts } from '../../core/formatting/number-format';

/** `hero` on the detail page, `list` in the station list, `tag` on map markers and popups. */
export type PriceSize = 'hero' | 'list' | 'tag';

/**
 * "1,85⁹ €" — German price with the tenth of a cent raised like on a price pylon.
 * Screen readers get the plain "1,859 €" instead of the split digits, or "kein Preis".
 */
@Component({
  selector: 'app-price',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'price',
    '[class.price--hero]': 'size() === "hero"',
    '[class.price--list]': 'size() === "list"',
    '[class.price--tag]': 'size() === "tag"',
  },
  template: `
    @if (parts(); as parts) {
      <span class="visually-hidden">{{ plainPrice() }}</span
      ><span aria-hidden="true"
        >{{ parts.leadingDigits }}<sup>{{ parts.tenthOfCent }}</sup> €</span
      >
    } @else {
      <span class="visually-hidden">kein Preis</span><span aria-hidden="true">–</span>
    }
  `,
  styleUrl: './price.scss',
})
export class Price {
  readonly priceInEuro = input.required<number | null>();
  readonly size = input<PriceSize>('list');

  protected readonly plainPrice = computed(() => {
    const price = this.priceInEuro();
    return price === null ? '' : formatPrice(price);
  });
  protected readonly parts = computed(() => {
    const price = this.priceInEuro();
    return price === null ? undefined : formatPriceParts(price);
  });
}
