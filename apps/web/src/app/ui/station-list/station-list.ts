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
import { CHEAPEST_PRICE_STANDALONE_LABEL } from '../../core/stations/price-labels';
import {
  addressLinesBelowTitle,
  navigationDestinationOf,
  priceInEuro,
  stationTitle,
} from '../../core/stations/station-display';
import type { NavigationDestination } from '../../core/navigation-apps/navigation-apps';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Icon } from '../icon/icon';
import { Price } from '../price/price';
import { RouteButton } from '../route-button/route-button';

interface StationListItem {
  stationIdentifier: string;
  destination: NavigationDestination;
  title: string;
  addressLine: string;
  priceInEuro: number | null;
  distance: string | undefined;
  isFavorite: boolean;
  isCheapest: boolean;
  isSelected: boolean;
}

const NO_STATION_IDENTIFIERS: ReadonlySet<string> = new Set();

/** Price board of stations: one hairline-separated row per station, the price loudest. */
@Component({
  selector: 'app-station-list',
  imports: [RouterLink, Price, FavoriteButton, Icon, RouteButton],
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

  protected readonly items = computed<StationListItem[]>(() =>
    this.stations().map(station => ({
      stationIdentifier: station.id,
      destination: navigationDestinationOf(station),
      title: stationTitle(station),
      addressLine: addressLinesBelowTitle(station).join(', '),
      priceInEuro: priceInEuro(station, this.fuelType()),
      distance:
        station.distanceInMeters === null ? undefined : formatDistance(station.distanceInMeters),
      isFavorite: this.favoriteStationIdentifiers().has(station.id),
      isCheapest: this.cheapestStationIdentifiers().has(station.id),
      isSelected: station.id === this.selectedStationIdentifier(),
    }))
  );

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

  /** Moves the focus to the title of a station's row, without scrolling the list. */
  focusStation(stationIdentifier: string): void {
    this.rowOf(stationIdentifier)
      ?.querySelector<HTMLElement>('.station-row__title')
      ?.focus({ preventScroll: true });
  }

  private rowOf(stationIdentifier: string): HTMLElement | undefined {
    return [...this.host.querySelectorAll<HTMLElement>('[data-station-identifier]')].find(
      candidate => candidate.dataset['stationIdentifier'] === stationIdentifier
    );
  }
}
