import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  viewChild,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import { FavoriteStationsResource } from '../../core/favorites/favorite-stations-resource';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { OFFLINE_MESSAGE, TRY_AGAIN_LATER } from '../../core/http/request-failure-messages';
import { NetworkStatus } from '../../core/network/network-status';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { StationList } from '../../ui/station-list/station-list';

/**
 * The starred stations with their current prices, shown in the explore page's sheet (or side
 * panel) instead of the list, like a guide in Apple Maps; the map stays next to it. Going back
 * (button or Escape) returns to the list.
 */
@Component({
  selector: 'app-favorites-page',
  imports: [StationList, LoadingState, RouterLink, DataSourceCredit, Icon],
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
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly isOnline = inject(NetworkStatus).isOnline;
  private readonly title = viewChild.required<ElementRef<HTMLElement>>('title');
  private readonly emptyStateHeading = viewChild<ElementRef<HTMLElement>>('emptyStateHeading');

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
  protected readonly offlineMessage = computed(() =>
    this.isOnline() ? undefined : OFFLINE_MESSAGE
  );
  /** While offline the notice explains every failed request, so no error shows next to it. */
  protected readonly errorMessage = computed(() => {
    if (!this.isOnline()) {
      return undefined;
    }
    const error = this.favoriteStations.error();
    if (error !== undefined) {
      return describeStationsError(error, { isOnline: true });
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
    if (stations.length === 0 && unavailableStationIdentifiers.length === 0) {
      return describeStationsError(firstFailure.error, { isOnline: true });
    }
    const failedFavorites =
      failures.length === 1 ? 'Ein Favorit konnte' : `${String(failures.length)} Favoriten konnten`;
    return `${failedFavorites} nicht geladen werden. ${TRY_AGAIN_LATER}`;
  });

  constructor() {
    // Prices shown in the explore sheet may be old by now; a first load is not requested twice.
    this.favoriteStations.refreshIfLoaded();
    // Screen readers and keyboards start at the title, as on a station card.
    afterNextRender(() => {
      this.title().nativeElement.focus();
    });
  }

  protected toggleFavorite(stationIdentifier: string): void {
    this.favorites.toggle(stationIdentifier);
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
    void this.router.navigateByUrl('/');
  }
}
