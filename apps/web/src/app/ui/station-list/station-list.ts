import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FuelType, Station } from '@genialtanken/contracts';
import { formatDistance } from '../../core/formatting/number-format';
import {
  formatCityLine,
  formatStreetLine,
  priceInEuro,
  stationSubtitle,
  stationTitle,
} from '../../core/stations/station-display';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Price } from '../price/price';

interface StationListItem {
  id: string;
  title: string;
  subtitle: string | undefined;
  streetLine: string;
  cityLine: string;
  priceInEuro: number | null;
  distance: string | undefined;
  isFavorite: boolean;
}

@Component({
  selector: 'app-station-list',
  imports: [RouterLink, Price, FavoriteButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-list.html',
  styleUrl: './station-list.scss',
})
export class StationList {
  readonly stations = input.required<readonly Station[]>();
  readonly fuelType = input.required<FuelType>();
  readonly favoriteStationIds = input.required<ReadonlySet<string>>();
  readonly favoriteToggled = output<string>();

  protected readonly items = computed<StationListItem[]>(() =>
    this.stations().map(station => ({
      id: station.id,
      title: stationTitle(station),
      subtitle: stationSubtitle(station),
      streetLine: formatStreetLine(station),
      cityLine: formatCityLine(station),
      priceInEuro: priceInEuro(station, this.fuelType()),
      distance:
        station.distanceInMeters === null ? undefined : formatDistance(station.distanceInMeters),
      isFavorite: this.favoriteStationIds().has(station.id),
    }))
  );
}
