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
  isSelected: boolean;
}

/** Details of one station with all its prices; the user's fuel leads the price board. */
@Component({
  selector: 'app-station-detail',
  imports: [FavoriteButton, OpeningTimes, Price, StationLocationMap],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-detail.html',
  styleUrl: './station-detail.scss',
})
export class StationDetail {
  readonly station = input.required<Station>();
  /** The user's fuel type, shown first and largest. */
  readonly fuelType = input.required<FuelType>();
  readonly isFavorite = input.required<boolean>();
  readonly favoriteToggled = output();

  protected readonly title = computed(() => stationTitle(this.station()));
  protected readonly subtitle = computed(() => stationSubtitle(this.station()));
  protected readonly streetLine = computed(() => formatStreetLine(this.station()));
  protected readonly cityLine = computed(() => formatCityLine(this.station()));
  protected readonly fuelPrices = computed<FuelPrice[]>(() => {
    const selectedFuelType = this.fuelType();
    const fuelPrices = FUEL_TYPES.map(fuelType => ({
      fuelType,
      label: FUEL_TYPE_LABELS[fuelType].long,
      priceInEuro: priceInEuro(this.station(), fuelType),
      isSelected: fuelType === selectedFuelType,
    }));
    return [
      ...fuelPrices.filter(fuelPrice => fuelPrice.isSelected),
      ...fuelPrices.filter(fuelPrice => !fuelPrice.isSelected),
    ];
  });
}
