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
  addressLinesOf,
  formatCityLine,
  navigationDestinationOf,
  priceInEuro,
  stationSubtitle,
  stationTitle,
} from '../../core/stations/station-display';
import { DataSourceCredit } from '../data-source-credit/data-source-credit';
import { FavoriteButton } from '../favorite-button/favorite-button';
import { Icon } from '../icon/icon';
import { OpeningTimes } from '../opening-times/opening-times';
import { Price } from '../price/price';
import { RouteButton } from '../route-button/route-button';

interface FuelPrice {
  fuelType: FuelType;
  label: string;
  priceInEuro: number | null;
  isSelected: boolean;
}

/**
 * A station as a place card of Apple Maps: name, the actions route, favorite and share, then the
 * price board led by the user's fuel, the opening times and the address.
 */
@Component({
  selector: 'app-station-detail',
  imports: [DataSourceCredit, FavoriteButton, Icon, OpeningTimes, Price, RouteButton],
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
  /** Offers "Teilen", where the browser has a share sheet. */
  readonly canShare = input(false);
  readonly favoriteToggled = output();
  readonly shareRequested = output();

  private readonly titleHeading = viewChild.required<ElementRef<HTMLElement>>('titleHeading');
  protected readonly pricesHeadingIdentifier = uniqueIdentifier('prices-heading');
  protected readonly openingTimesHeadingIdentifier = uniqueIdentifier('opening-times-heading');
  protected readonly addressHeadingIdentifier = uniqueIdentifier('address-heading');

  protected readonly title = computed(() => stationTitle(this.station()));
  protected readonly destination = computed(() => navigationDestinationOf(this.station()));
  /** The station's name, otherwise its city; never a repetition of the title. */
  protected readonly subtitle = computed(() => {
    const station = this.station();
    const name = stationSubtitle(station);
    if (name !== undefined) {
      return name;
    }
    const cityLine = formatCityLine(station);
    return cityLine === '' || cityLine === this.title() ? undefined : cityLine;
  });
  protected readonly addressLines = computed(() => addressLinesOf(this.station()));
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
