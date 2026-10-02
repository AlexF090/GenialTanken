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
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationList } from '../../ui/station-list/station-list';

@Component({
  selector: 'app-favorites-page',
  imports: [PageHeader, StationList, LoadingState],
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
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly favoriteStationIds = this.favorites.favoriteStationIdSet;
  protected readonly hasFavorites = computed(() => this.favoriteStationIds().size > 0);

  /**
   * Loaded once per visit for the favorites present on arrival. Unstarring only hides a
   * station (see `stations`), so the list updates immediately without refetching.
   * Favorites are never removed automatically: a 404 can be temporary, e.g. for German stations
   * while the German provider is disabled.
   */
  private readonly favoriteStationsResource = resource({
    loader: () => this.stationsApi.loadStationsByIds(this.favorites.favoriteStationIds()),
  });

  protected readonly stations = computed(() => {
    if (!this.favoriteStationsResource.hasValue()) {
      return [];
    }
    const favoriteStationIds = this.favoriteStationIds();
    return this.favoriteStationsResource
      .value()
      .stations.filter(station => favoriteStationIds.has(station.id));
  });
  private readonly unavailableStationIds = computed(() => {
    if (!this.favoriteStationsResource.hasValue()) {
      return [];
    }
    const favoriteStationIds = this.favoriteStationIds();
    return this.favoriteStationsResource
      .value()
      .unavailableStationIds.filter(stationId => favoriteStationIds.has(stationId));
  });
  protected readonly unavailableMessage = computed(() => {
    const count = this.unavailableStationIds().length;
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
    const { stations, unavailableStationIds, failures } = this.favoriteStationsResource.value();
    const [firstFailure] = failures;
    if (firstFailure === undefined) {
      return undefined;
    }
    if (stations.length === 0 && unavailableStationIds.length === 0) {
      return describeStationsError(firstFailure.error);
    }
    return failures.length === 1
      ? 'Ein Favorit konnte nicht geladen werden. Bitte versuche es später erneut.'
      : `${String(failures.length)} Favoriten konnten nicht geladen werden. Bitte versuche es später erneut.`;
  });

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }

  protected removeUnavailableFavorites(): void {
    this.favorites.remove(this.unavailableStationIds());
    // The button disappears with the notice; keep keyboard and screen reader users oriented
    afterNextRender(() => this.contentHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }
}
