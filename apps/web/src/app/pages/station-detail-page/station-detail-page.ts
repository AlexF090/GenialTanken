import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { PRIMARY_OUTLET, Router } from '@angular/router';
import type { UrlTree } from '@angular/router';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationDetail } from '../../ui/station-detail/station-detail';

/** "Zurück" leads to the favorites when the station was opened there, else to the start page. */
const backLinkAfter = (previousUrl: UrlTree | undefined): string => {
  const segments = previousUrl?.root.children[PRIMARY_OUTLET]?.segments ?? [];
  return segments.length === 1 && segments[0]?.path === 'favorites' ? '/favorites' : '/';
};

@Component({
  selector: 'app-station-detail-page',
  imports: [PageHeader, StationDetail, LoadingState, DataSourceCredit],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-detail-page.html',
})
export class StationDetailPage {
  /** Route parameter `:id`, bound through `withComponentInputBinding`. */
  readonly id = input.required<string>();

  /** The page is created while the navigation to it runs, which knows the page before. */
  protected readonly backLink = backLinkAfter(
    inject(Router).currentNavigation()?.previousNavigation?.finalUrl
  );

  private readonly favorites = inject(FavoritesStore);
  private readonly stationResource = inject(StationsApi).stationById(() => this.id());

  protected readonly station = computed(() =>
    this.stationResource.hasValue() ? this.stationResource.value() : undefined
  );
  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly isLoading = this.stationResource.isLoading;
  protected readonly errorMessage = computed(() => {
    const error = this.stationResource.error();
    return error === undefined ? undefined : describeStationsError(error);
  });
  protected readonly isFavorite = computed(() => this.favorites.isFavorite(this.id()));

  protected toggleFavorite(): void {
    this.favorites.toggle(this.id());
  }
}
