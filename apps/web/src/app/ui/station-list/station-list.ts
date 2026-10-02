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
import {
  formatCityLine,
  formatStreetLine,
  navigationDestinationOf,
  priceInEuro,
  stationSubtitle,
  stationTitle,
} from '../../core/stations/station-display';
import type { NavigationDestination } from '../../core/navigation-apps/navigation-apps';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Icon } from '../icon/icon';
import { Price } from '../price/price';
import { RouteButton } from '../route-button/route-button';

interface StationListItem {
  id: string;
  destination: NavigationDestination;
  title: string;
  subtitle: string | undefined;
  addressLine: string;
  priceInEuro: number | null;
  distance: string | undefined;
  isFavorite: boolean;
  isCheapest: boolean;
  isSelected: boolean;
}

const NO_STATION_IDS: ReadonlySet<string> = new Set();

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
  readonly favoriteStationIds = input.required<ReadonlySet<string>>();
  readonly selectedStationId = input<string>();
  readonly cheapestStationIds = input<ReadonlySet<string>>(NO_STATION_IDS);
  /** Renders the "Auf Karte zeigen" toggle per row; bind `stationSelected` along with it. */
  /**
   * On the explore page a row selects its station on the map, and a details button opens the
   * detail page. Otherwise the title links to the detail page.
   */
  readonly selectsOnMap = input(false);
  readonly favoriteToggled = output<string>();
  readonly stationSelected = output<string>();

  protected readonly items = computed<StationListItem[]>(() =>
    this.stations().map(station => ({
      id: station.id,
      destination: navigationDestinationOf(station),
      title: stationTitle(station),
      subtitle: stationSubtitle(station),
      addressLine: [formatStreetLine(station), formatCityLine(station)]
        .filter(line => line !== '')
        .join(', '),
      priceInEuro: priceInEuro(station, this.fuelType()),
      distance:
        station.distanceInMeters === null ? undefined : formatDistance(station.distanceInMeters),
      isFavorite: this.favoriteStationIds().has(station.id),
      isCheapest: this.cheapestStationIds().has(station.id),
      isSelected: station.id === this.selectedStationId(),
    }))
  );

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterRenderEffect(() => {
      const selectedStationId = this.selectedStationId();
      if (selectedStationId === undefined) {
        return;
      }
      const row = [...host.nativeElement.querySelectorAll<HTMLElement>('[data-station-id]')].find(
        candidate => candidate.dataset['stationId'] === selectedStationId
      );
      // jsdom does not implement scrolling
      if (row !== undefined && typeof row.scrollIntoView === 'function') {
        row.scrollIntoView({ block: 'nearest' });
      }
    });
  }
}
