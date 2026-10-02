import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PageHeader } from '../../ui/page-header/page-header';
import { StationDetail } from '../../ui/station-detail/station-detail';

@Component({
  selector: 'app-station-detail-page',
  imports: [PageHeader, StationDetail, LoadingState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-detail-page.html',
})
export class StationDetailPage {
  /** Route parameter `:id`, bound through `withComponentInputBinding`. */
  readonly id = input.required<string>();

  private readonly favorites = inject(FavoritesStore);
  private readonly stationResource = inject(StationsApi).stationById(() => this.id());

  protected readonly station = computed(() =>
    this.stationResource.hasValue() ? this.stationResource.value() : undefined
  );
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
