import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FUEL_TYPES } from '@genialtanken/contracts';
import type { FuelType, Station } from '@genialtanken/contracts';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import {
  formatCityLine,
  formatStreetLine,
  priceInEuro,
  stationSubtitle,
  stationTitle,
} from '../../core/stations/station-display';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { OpeningTimes } from '../opening-times/opening-times';
import { Price } from '../price/price';
import { StationLocationMap } from '../station-location-map/station-location-map';

interface FuelPrice {
  fuelType: FuelType;
  label: string;
  priceInEuro: number | null;
}

@Component({
  selector: 'app-station-detail',
  imports: [FavoriteButton, OpeningTimes, Price, StationLocationMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-detail.html',
  styleUrl: './station-detail.scss',
})
export class StationDetail {
  readonly station = input.required<Station>();
  readonly isFavorite = input.required<boolean>();
  readonly favoriteToggled = output();

  protected readonly title = computed(() => stationTitle(this.station()));
  protected readonly subtitle = computed(() => stationSubtitle(this.station()));
  protected readonly streetLine = computed(() => formatStreetLine(this.station()));
  protected readonly cityLine = computed(() => formatCityLine(this.station()));
  protected readonly fuelPrices = computed<FuelPrice[]>(() =>
    FUEL_TYPES.map(fuelType => ({
      fuelType,
      label: FUEL_TYPE_LABELS[fuelType].long,
      priceInEuro: priceInEuro(this.station(), fuelType),
    }))
  );
}
