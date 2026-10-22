import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  output,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FuelType, Station } from '@genialtanken/contracts';
import { formatDistance } from '../../core/formatting/number-format';
import { stationRoute } from '../../core/navigation/station-route';
import {
  CHEAPEST_PRICE_SHORT_LABEL,
  CHEAPEST_PRICE_STANDALONE_LABEL,
} from '../../core/stations/price-labels';
import { priceLevelOf, priceRangeOf } from '../../core/stations/price-level';
import type { PriceLevel, PriceRange } from '../../core/stations/price-level';
import {
  addressLinesBelowTitle,
  priceInEuro,
  stationTitle,
} from '../../core/stations/station-display';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Icon } from '../icon/icon';
import { Price } from '../price/price';

interface StationListItem {
  stationIdentifier: string;
  title: string;
  addressLine: string;
  priceInEuro: number | null;
  /** Tints the price tile like the station's price tag on the map. */
  priceTint: PriceTint;
  distance: string | undefined;
  isFavorite: boolean;
  isCheapest: boolean;
  isSelected: boolean;
}

/** The cheapest price is solid green, every other price tinted by its level. */
type PriceTint = PriceLevel | 'cheapest' | 'without-price';

const NO_STATION_IDENTIFIERS: ReadonlySet<string> = new Set();

const priceTintOf = (
  price: number | null,
  priceRange: PriceRange | undefined,
  isCheapest: boolean
): PriceTint => {
  if (price === null || priceRange === undefined) {
    return 'without-price';
  }
  return isCheapest ? 'cheapest' : priceLevelOf(price, priceRange);
};

/**
 * Stations as an iOS list: per row a price tile tinted like the price tags on the map, the
 * station with distance and address, and its actions.
 */
@Component({
  selector: 'app-station-list',
  imports: [RouterLink, Price, FavoriteButton, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-list.html',
  styleUrl: './station-list.scss',
})
export class StationList {
  readonly stations = input.required<readonly Station[]>();
  readonly fuelType = input.required<FuelType>();
  readonly favoriteStationIdentifiers = input.required<ReadonlySet<string>>();
  readonly selectedStationIdentifier = input<string>();
  readonly cheapestStationIdentifiers = input<ReadonlySet<string>>(NO_STATION_IDENTIFIERS);
  /**
   * On the explore page a row selects its station on the map, and a details button opens the
   * detail page. Otherwise the title links to the detail page.
   */
  readonly selectsOnMap = input(false);
  readonly favoriteToggled = output<string>();
  readonly stationSelected = output<string>();

  protected readonly stationRoute = stationRoute;
  protected readonly cheapestPriceLabel = CHEAPEST_PRICE_STANDALONE_LABEL;
  protected readonly cheapestPriceShortLabel = CHEAPEST_PRICE_SHORT_LABEL;

  protected readonly items = computed<StationListItem[]>(() => {
    const fuelType = this.fuelType();
    const priceRange = priceRangeOf(this.stations().map(station => priceInEuro(station, fuelType)));
    return this.stations().map(station => {
      const price = priceInEuro(station, fuelType);
      const isCheapest = this.cheapestStationIdentifiers().has(station.id);
      return {
        stationIdentifier: station.id,
        title: stationTitle(station),
        addressLine: addressLinesBelowTitle(station).join(', '),
        priceInEuro: price,
        priceTint: priceTintOf(price, priceRange, isCheapest),
        distance:
          station.distanceInMeters === null ? undefined : formatDistance(station.distanceInMeters),
        isFavorite: this.favoriteStationIdentifiers().has(station.id),
        isCheapest,
        isSelected: station.id === this.selectedStationIdentifier(),
      };
    });
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterRenderEffect(() => {
      const selectedStationIdentifier = this.selectedStationIdentifier();
      if (selectedStationIdentifier === undefined) {
        return;
      }
      const row = this.rowOf(selectedStationIdentifier);
      // jsdom does not implement scrolling
      if (row !== undefined && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  /**
   * Moves the focus to the title of a station's row, without scrolling the list. `false` when the
   * list has no row for the station, so the caller can focus something else.
   */
  focusStation(stationIdentifier: string): boolean {
    const title = this.rowOf(stationIdentifier)?.querySelector<HTMLElement>('.station-row__title');
    if (title === null || title === undefined) {
      return false;
    }
    title.focus({ preventScroll: true });
    return true;
  }

  private rowOf(stationIdentifier: string): HTMLElement | undefined {
    return [...this.host.querySelectorAll<HTMLElement>('[data-station-identifier]')].find(
      candidate => candidate.dataset['stationIdentifier'] === stationIdentifier
    );
  }
}
