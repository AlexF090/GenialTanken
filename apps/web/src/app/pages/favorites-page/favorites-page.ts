import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  Injector,
  resource,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationList } from '../../ui/station-list/station-list';

@Component({
  selector: 'app-favorites-page',
  imports: [PageHeader, StationList, LoadingState, RouterLink, DataSourceCredit],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './favorites-page.html',
  styleUrl: './favorites-page.scss',
})
export class FavoritesPage {
  private readonly favorites = inject(FavoritesStore);
  private readonly stationsApi = inject(StationsApi);
  private readonly injector = inject(Injector);
  /** Heading of whichever state is shown: the list or the empty state. */
  private readonly contentHeading = viewChild<ElementRef<HTMLElement>>('contentHeading');

  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly favoriteStationIdentifiers = this.favorites.favoriteStationIdentifierSet;
  protected readonly hasFavorites = computed(() => this.favoriteStationIdentifiers().size > 0);

  /**
   * Loaded once per visit for the favorites present on arrival. Unstarring only hides a
   * station (see `stations`), so the list updates immediately without refetching.
   * Favorites are never removed automatically: a 404 can be temporary, e.g. for a station the
   * French price service does not list at the moment.
   */
  private readonly favoriteStationsResource = resource({
    loader: () =>
      this.stationsApi.loadStationsByIdentifiers(this.favorites.favoriteStationIdentifiers()),
  });

  protected readonly stations = computed(() => {
    if (!this.favoriteStationsResource.hasValue()) {
      return [];
    }
    const favoriteStationIdentifiers = this.favoriteStationIdentifiers();
    return this.favoriteStationsResource
      .value()
      .stations.filter(station => favoriteStationIdentifiers.has(station.id));
  });
  /**
   * The Licence Ouverte requires the credit wherever French prices show. Every station is French
   * while France is the only country; with another one, check `station.country` here again.
   */
  protected readonly showsFrenchPrices = computed(() => this.stations().length > 0);
  private readonly unavailableStationIdentifiers = computed(() => {
    if (!this.favoriteStationsResource.hasValue()) {
      return [];
    }
    const favoriteStationIdentifiers = this.favoriteStationIdentifiers();
    return this.favoriteStationsResource
      .value()
      .unavailableStationIdentifiers.filter(stationIdentifier =>
        favoriteStationIdentifiers.has(stationIdentifier)
      );
  });
  protected readonly unavailableMessage = computed(() => {
    const count = this.unavailableStationIdentifiers().length;
    if (count === 0) {
      return undefined;
    }
    return count === 1
      ? 'Ein Favorit ist gerade nicht verfügbar.'
      : `${String(count)} Favoriten sind gerade nicht verfügbar.`;
  });
  protected readonly isLoading = this.favoriteStationsResource.isLoading;
  protected readonly errorMessage = computed(() => {
    const error = this.favoriteStationsResource.error();
    if (error !== undefined) {
      return describeStationsError(error);
    }
    if (!this.favoriteStationsResource.hasValue()) {
      return undefined;
    }
    const { stations, unavailableStationIdentifiers, failures } =
      this.favoriteStationsResource.value();
    const [firstFailure] = failures;
    if (firstFailure === undefined) {
      return undefined;
    }
    if (stations.length === 0 && unavailableStationIdentifiers.length === 0) {
      return describeStationsError(firstFailure.error);
    }
    return failures.length === 1
      ? 'Ein Favorit konnte nicht geladen werden. Bitte versuche es später erneut.'
      : `${String(failures.length)} Favoriten konnten nicht geladen werden. Bitte versuche es später erneut.`;
  });

  protected toggleFavorite(stationIdentifier: string): void {
    this.favorites.toggle(stationIdentifier);
  }

  protected removeUnavailableFavorites(): void {
    this.favorites.remove(this.unavailableStationIdentifiers());
    // The button disappears with the notice; keep keyboard and screen reader users oriented
    afterNextRender(() => this.contentHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
