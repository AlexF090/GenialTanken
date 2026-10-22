import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { NetworkStatus, reloadWhenReconnected } from '../../core/network/network-status';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { CURRENT_DATE } from '../../core/time/current-date';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { StationDetail } from '../../ui/station-detail/station-detail';
import { resourceValueOr } from '../../core/resource-value-or';

/**
 * One station as a card in the explore page's sheet (or side panel), like a place in Apple Maps:
 * the map next to it shows the station. Closing (button or Escape) returns to the list.
 */
@Component({
  selector: 'app-station-detail-page',
  imports: [StationDetail, LoadingState, DataSourceCredit, Icon, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './station-detail-page.html',
  styleUrl: './station-detail-page.scss',
  host: {
    '(keydown.escape)': 'close()',
  },
})
export class StationDetailPage {
  /** Route parameter `:id`, bound through `withComponentInputBinding`. */
  readonly id = input.required<string>();

  private readonly router = inject(Router);
  private readonly stationDetail = viewChild(StationDetail);
  private readonly favorites = inject(FavoritesStore);
  private readonly stationResource = inject(StationsApi).stationByIdentifier(() => this.id());
  private readonly isOnline = inject(NetworkStatus).isOnline;

  protected readonly station = computed(() => resourceValueOr(this.stationResource, undefined));
  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly today = inject(CURRENT_DATE);
  protected readonly isLoading = this.stationResource.isLoading;
  protected readonly errorMessage = computed(() => {
    const error = this.stationResource.error();
    return error === undefined
      ? undefined
      : describeStationsError(error, { isOnline: this.isOnline() });
  });
  protected readonly isFavorite = computed(() => this.favorites.isFavorite(this.id()));

  constructor() {
    reloadWhenReconnected(this.stationResource);
    const openedStation = inject(OpenedStationStore);
    effect(() => {
      const station = this.station();
      if (station !== undefined) {
        openedStation.open(station);
      }
    });
    inject(DestroyRef).onDestroy(() => {
      openedStation.close();
    });

    // Screen readers and keyboards start at the station's name once it is shown.
    let focusedStationIdentifier: string | undefined;
    afterRenderEffect(() => {
      const station = this.station();
      const stationDetail = this.stationDetail();
      if (
        station === undefined ||
        stationDetail === undefined ||
        station.id === focusedStationIdentifier
      ) {
        return;
      }
      focusedStationIdentifier = station.id;
      stationDetail.focusTitle();
    });
  }

  protected toggleFavorite(): void {
    this.favorites.toggle(this.id());
  }

  protected close(): void {
    void this.router.navigateByUrl('/');
  }
}
