import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
} from '@angular/core';
import { Router } from '@angular/router';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { StationDetail } from '../../ui/station-detail/station-detail';

/**
 * One station as a card in the explore page's sheet (or side panel), like a place in Apple Maps:
 * the map next to it shows the station. Closing (button or Escape) returns to the list.
 */
@Component({
  selector: 'app-station-detail-page',
  imports: [StationDetail, LoadingState, DataSourceCredit, Icon],
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

  constructor() {
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

    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    // Screen readers and keyboards start at the station's name once it is shown.
    let focusedStationId: string | undefined;
    afterRenderEffect(() => {
      const station = this.station();
      if (station === undefined || station.id === focusedStationId) {
        return;
      }
      focusedStationId = station.id;
      host.querySelector<HTMLElement>('.station-detail__title')?.focus({ preventScroll: true });
    });
  }

  protected toggleFavorite(): void {
    this.favorites.toggle(this.id());
  }

  protected close(): void {
    void this.router.navigateByUrl('/');
  }
}
