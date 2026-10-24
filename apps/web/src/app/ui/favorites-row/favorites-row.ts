import type { ElementRef } from '@angular/core';
import { ChangeDetectionStrategy, Component, computed, input, viewChild } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { FuelType, Station } from '@genialtanken/contracts';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import { formatDistance } from '../../core/formatting/number-format';
import { FAVORITES_ROUTE_PATH } from '../../core/navigation/explore-routes';
import { stationRoute } from '../../core/navigation/station-route';
import { priceInEuro, stationTitle } from '../../core/stations/station-display';
import { Price } from '../price/price';
import { SkeletonRows } from '../skeleton-rows/skeleton-rows';

/** Two hold the row's place; more would only guess at the length of a list still loading. */
const MAXIMUM_PLACEHOLDER_COUNT = 2;

interface FavoriteCard {
  stationIdentifier: string;
  route: string[];
  title: string;
  priceInEuro: number | null;
  distance: string | undefined;
}

/**
 * The starred stations as a row of small cards, like the favorites of Apple Maps: each shows
 * the price of the chosen fuel and opens the station's card; "Alle" opens the whole list.
 * Renders nothing without favorites; placeholders hold their place while they load for the first
 * time, and a reload keeps the shown ones. On narrow screens the cards stack instead of scrolling
 * sideways.
 */
@Component({
  selector: 'app-favorites-row',
  imports: [RouterLink, Price, SkeletonRows],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favorites-row.html',
  styleUrl: './favorites-row.scss',
})
export class FavoritesRow {
  readonly stations = input.required<readonly Station[]>();
  readonly fuelType = input.required<FuelType>();
  /** The favorites are loading, the first time or again. */
  readonly isLoading = input(false);
  /** How many favorites are stored; sizes the placeholders before the first ones load. */
  readonly favoriteCount = input(MAXIMUM_PLACEHOLDER_COUNT);

  private readonly allLink = viewChild<ElementRef<HTMLElement>>('allLink');

  protected readonly headingIdentifier = uniqueIdentifier('favorites-row-heading');
  protected readonly favoritesRoute = `/${FAVORITES_ROUTE_PATH}`;
  protected readonly placeholderCount = computed(() =>
    Math.min(this.favoriteCount(), MAXIMUM_PLACEHOLDER_COUNT)
  );
  protected readonly cards = computed<FavoriteCard[]>(() =>
    this.stations().map(station => ({
      stationIdentifier: station.id,
      route: stationRoute(station.id),
      title: stationTitle(station),
      priceInEuro: priceInEuro(station, this.fuelType()),
      distance:
        station.distanceInMeters === null ? undefined : formatDistance(station.distanceInMeters),
    }))
  );

  /** Moves the focus to "Alle", e.g. when the list of all favorites closes; false without it. */
  focusAllLink(): boolean {
    const allLink = this.allLink()?.nativeElement;
    allLink?.focus({ preventScroll: true });
    return allLink !== undefined;
  }
}
