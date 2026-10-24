import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  Injector,
  signal,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { Location } from '@angular/common';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import { FavoriteStationsResource } from '../../core/favorites/favorite-stations-resource';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { injectCloseToExplore } from '../../core/navigation/close-to-explore';
import { OFFLINE_MESSAGE, TRY_AGAIN_LATER } from '../../core/http/request-failure-messages';
import { NetworkStatus } from '../../core/network/network-status';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { Icon } from '../../ui/icon/icon';
import { SkeletonRows } from '../../ui/skeleton-rows/skeleton-rows';
import { StationList } from '../../ui/station-list/station-list';

const MAXIMUM_PLACEHOLDER_COUNT = 5;

const STALE_PRICES_HINT = 'Angezeigte Preise sind womöglich nicht mehr aktuell.';

const withStalePricesHint = (message: string, showsStalePrices: boolean): string =>
  showsStalePrices ? `${message} ${STALE_PRICES_HINT}` : message;

/** The station after the given one in the list, else the one before it. */
const neighborOf = (
  stationIdentifier: string,
  stationIdentifiers: readonly string[]
): string | undefined => {
  const index = stationIdentifiers.indexOf(stationIdentifier);
  if (index === -1) {
    return undefined;
  }
  return stationIdentifiers[index + 1] ?? stationIdentifiers[index - 1];
};

/**
 * The starred stations with their current prices, shown in the explore page's sheet (or side
 * panel) instead of the list, like a guide in Apple Maps; the map stays next to it. Going back
 * (button or Escape) returns to the list.
 */
@Component({
  selector: 'app-favorites-page',
  imports: [StationList, SkeletonRows, DataSourceCredit, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favorites-page.html',
  styleUrl: './favorites-page.scss',
  host: {
    '(keydown.escape)': 'close()',
  },
})
export class FavoritesPage {
  private readonly favorites = inject(FavoritesStore);
  private readonly favoriteStations = inject(FavoriteStationsResource);
  private readonly closeToExplore = injectCloseToExplore();
  private readonly injector = inject(Injector);
  private readonly isOnline = inject(NetworkStatus).isOnline;
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');
  private readonly stationList = viewChild(StationList);
  private readonly emptyStateHeading = viewChild<ElementRef<HTMLElement>>('emptyStateHeading');

  /** A real address, so the link still opens in a new tab or copies like any other. */
  protected readonly exploreHref = inject(Location).prepareExternalUrl('/');
  protected readonly titleIdentifier = uniqueIdentifier('favorites-title');
  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly favoriteStationIdentifiers = this.favorites.favoriteStationIdentifierSet;
  protected readonly hasFavorites = computed(() => this.favoriteStationIdentifiers().size > 0);

  protected readonly stations = this.favoriteStations.stations;
  /**
   * The Licence Ouverte requires the credit wherever French prices show. Every station is French
   * while France is the only country; with another one, check `station.country` here again.
   */
  protected readonly showsFrenchPrices = computed(() => this.stations().length > 0);
  private readonly unavailableStationIdentifiers =
    this.favoriteStations.unavailableStationIdentifiers;
  protected readonly unavailableMessage = computed(() => {
    const count = this.unavailableStationIdentifiers().length;
    if (count === 0) {
      return undefined;
    }
    return count === 1
      ? 'Ein Favorit ist gerade nicht verfügbar.'
      : `${String(count)} Favoriten sind gerade nicht verfügbar.`;
  });
  protected readonly isLoading = this.favoriteStations.isLoading;
  /** Set a task after the first render, once the empty status region is in the document. */
  private readonly isLoadingStatusReady = signal(false);
  protected readonly announcesLoading = computed(
    () => this.isLoadingStatusReady() && this.hasFavorites() && this.isLoading()
  );
  /** One placeholder per favorite, up to a screenful. */
  protected readonly placeholderCount = computed(() =>
    Math.min(this.favoriteStationIdentifiers().size, MAXIMUM_PLACEHOLDER_COUNT)
  );
  protected readonly offlineMessage = computed(() =>
    this.isOnline() ? undefined : OFFLINE_MESSAGE
  );
  /**
   * While offline the notice explains every failed request, so no error shows next to it. Prices
   * that failed to refresh stay shown, so the message says they may be outdated.
   */
  protected readonly errorMessage = computed(() => {
    if (!this.isOnline()) {
      return undefined;
    }
    const shownStationIdentifiers = new Set(this.stations().map(station => station.id));
    const error = this.favoriteStations.error();
    if (error !== undefined) {
      return withStalePricesHint(
        describeStationsError(error, { isOnline: true }),
        shownStationIdentifiers.size > 0
      );
    }
    const loaded = this.favoriteStations.loaded();
    if (loaded === undefined) {
      return undefined;
    }
    const { stations, unavailableStationIdentifiers, failures } = loaded;
    const [firstFailure] = failures;
    if (firstFailure === undefined) {
      return undefined;
    }
    const failedStationIdentifiers = new Set(failures.map(failure => failure.stationIdentifier));
    const showsStalePrices = failures.some(failure =>
      shownStationIdentifiers.has(failure.stationIdentifier)
    );
    const hasFreshStations = stations.some(station => !failedStationIdentifiers.has(station.id));
    if (!hasFreshStations && unavailableStationIdentifiers.length === 0) {
      return withStalePricesHint(
        describeStationsError(firstFailure.error, { isOnline: true }),
        showsStalePrices
      );
    }
    const failedFavorites =
      failures.length === 1 ? 'Ein Favorit konnte' : `${String(failures.length)} Favoriten konnten`;
    return withStalePricesHint(
      `${failedFavorites} nicht geladen werden. ${TRY_AGAIN_LATER}`,
      showsStalePrices
    );
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    // Prices shown in the explore sheet may be old by now; a first load is not requested twice.
    this.favoriteStations.refreshIfLoaded();
    // Screen readers and keyboards start at the title, as on a station card.
    afterNextRender(() => {
      this.title().nativeElement.focus();
      const timer = setTimeout(() => {
        this.isLoadingStatusReady.set(true);
      });
      destroyRef.onDestroy(() => {
        clearTimeout(timer);
      });
    });
  }

  /**
   * Every row here is starred, so a toggle unstars the station and its row, with the focused star,
   * disappears. The focus moves on to the next star, else the one before, else the empty state.
   */
  protected toggleFavorite(stationIdentifier: string): void {
    const neighborStationIdentifier = neighborOf(
      stationIdentifier,
      this.stations().map(station => station.id)
    );
    this.favorites.toggle(stationIdentifier);
    afterNextRender(
      () => {
        if (
          neighborStationIdentifier !== undefined &&
          this.stationList()?.focusFavoriteButton(neighborStationIdentifier) === true
        ) {
          return;
        }
        (this.emptyStateHeading() ?? this.title()).nativeElement.focus();
      },
      { injector: this.injector }
    );
  }

  protected removeUnavailableFavorites(): void {
    this.favorites.remove(this.unavailableStationIdentifiers());
    // The button disappears with the notice; keep keyboard and screen reader users oriented
    afterNextRender(
      () => {
        (this.emptyStateHeading() ?? this.title()).nativeElement.focus();
      },
      { injector: this.injector }
    );
  }

  protected close(): void {
    this.closeToExplore();
  }

  /** Closes like „Zurück“ instead of pushing the explore page; other clicks stay the browser's. */
  protected closeFromLink(event: MouseEvent): void {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    this.close();
  }
}
