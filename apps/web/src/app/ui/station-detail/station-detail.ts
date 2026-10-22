import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { FUEL_TYPES } from '@genialtanken/contracts';
import type { FuelType, Station } from '@genialtanken/contracts';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import {
  addressLinesBelowTitle,
  navigationDestinationOf,
  priceInEuro,
  stationSubtitle,
  stationTitle,
} from '../../core/stations/station-display';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { OpeningTimes } from '../opening-times/opening-times';
import { Price } from '../price/price';
import { RouteButton } from '../route-button/route-button';

interface FuelPrice {
  fuelType: FuelType;
  label: string;
  priceInEuro: number | null;
  isSelected: boolean;
}

/** Details of one station with all its prices; the user's fuel leads the price board. */
@Component({
  selector: 'app-station-detail',
  imports: [FavoriteButton, OpeningTimes, Price, RouteButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-detail.html',
  styleUrl: './station-detail.scss',
})
export class StationDetail {
  readonly station = input.required<Station>();
  /** The user's fuel type, shown first and largest. */
  readonly fuelType = input.required<FuelType>();
  readonly isFavorite = input.required<boolean>();
  /** Marks today in the opening times. */
  readonly today = input.required<Date>();
  readonly favoriteToggled = output();

  private readonly titleHeading = viewChild.required<ElementRef<HTMLElement>>('titleHeading');
  protected readonly pricesHeadingIdentifier = uniqueIdentifier('prices-heading');
  protected readonly openingTimesHeadingIdentifier = uniqueIdentifier('opening-times-heading');

  protected readonly title = computed(() => stationTitle(this.station()));
  protected readonly destination = computed(() => navigationDestinationOf(this.station()));
  protected readonly subtitle = computed(() => stationSubtitle(this.station()));
  protected readonly addressLines = computed(() => addressLinesBelowTitle(this.station()));
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

  /** Moves the focus to the station's name, e.g. once the card is shown. */
  focusTitle(): void {
    this.titleHeading().nativeElement.focus({ preventScroll: true });
  }
}
