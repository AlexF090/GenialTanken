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
import { priceLevelOf, priceRangeOf } from '../../core/stations/price-level';
import type { PriceRange } from '../../core/stations/price-level';
import {
  addressLinesBelowTitle,
  priceInEuro,
  stationTitle,
} from '../../core/stations/station-display';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Icon } from '../icon/icon';
import { PriceTile } from '../price-tile/price-tile';
import type { PriceTint } from '../price-tile/price-tile';

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
  imports: [RouterLink, PriceTile, FavoriteButton, Icon],
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

  protected readonly items = computed<StationListItem[]>(() => {
    const fuelType = this.fuelType();
    const pricedStations = this.stations().map(station => ({
      station,
      price: priceInEuro(station, fuelType),
    }));
    const priceRange = priceRangeOf(pricedStations.map(({ price }) => price));
    return pricedStations.map(({ station, price }) => {
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

  /**
   * Moves the focus to the star of a station's row, e.g. after unstarring a neighbor removed the
   * focused one. `false` when the list has no row for the station.
   */
  focusFavoriteButton(stationIdentifier: string): boolean {
    const favoriteButton = this.rowOf(stationIdentifier)?.querySelector<HTMLElement>(
      'app-favorite-button button'
    );
    if (favoriteButton === null || favoriteButton === undefined) {
      return false;
    }
    favoriteButton.focus();
    return true;
  }

  private rowOf(stationIdentifier: string): HTMLElement | undefined {
    return [...this.host.querySelectorAll<HTMLElement>('[data-station-identifier]')].find(
      candidate => candidate.dataset['stationIdentifier'] === stationIdentifier
    );
  }
}
