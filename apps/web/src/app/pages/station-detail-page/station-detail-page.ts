import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  DOCUMENT,
  effect,
  inject,
  input,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router } from '@angular/router';
import type { Station } from '@genialtanken/contracts';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { NetworkStatus, reloadWhenReconnected } from '../../core/network/network-status';
import { isOutdated, KnownStations } from '../../core/stations/known-stations';
import type { KnownStation } from '../../core/stations/known-stations';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { describeStationsError } from '../../core/stations/stations-error-message';
import { StationsApi } from '../../core/stations/stations-api';
import { CURRENT_DATE } from '../../core/time/current-date';
import { injectLoadedAt } from '../../core/time/loaded-at';
import { Logger } from '../../core/logging/logger';
import { injectCloseToExplore } from '../../core/navigation/close-to-explore';
import { stationRoute } from '../../core/navigation/station-route';
import { isShareCanceled, SHARE } from '../../core/sharing/share';
import { addressLinesOf, stationTitle } from '../../core/stations/station-display';
import { CloseButton } from '../../ui/close-button/close-button';
import { SkeletonRows } from '../../ui/skeleton-rows/skeleton-rows';
import { COLD_START_HINT, injectShowsColdStartHint } from '../../core/api-wake-up/cold-start-hint';
import { StationDetail } from '../../ui/station-detail/station-detail';
import { resourceValueOr } from '../../core/resource-value-or';

interface ShownStation {
  readonly stationIdentifier: string;
  readonly knownStation: KnownStation | undefined;
}

/**
 * One station as a card in the explore page's sheet (or side panel), like a place in Apple Maps:
 * the map next to it shows the station. Closing (button or Escape) returns to the list.
 */
@Component({
  selector: 'app-station-detail-page',
  imports: [StationDetail, SkeletonRows, CloseButton, NgTemplateOutlet],
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
  private readonly closeToExplore = injectCloseToExplore();
  private readonly stationDetail = viewChild(StationDetail);
  private readonly favorites = inject(FavoritesStore);
  private readonly knownStations = inject(KnownStations);
  private readonly knownStation = computed(() => this.knownStations.find(this.id()));
  protected readonly today = inject(CURRENT_DATE);
  /**
   * Requested only for a station the app has not loaded yet (e.g. from a shared link) or whose
   * known prices are outdated; those show meanwhile. Decided once per station (`untracked`), so
   * the request neither starts nor stops when the known stations change.
   */
  private readonly stationResource = inject(StationsApi).stationByIdentifier(() => {
    const stationIdentifier = this.id();
    const knownStation = untracked(this.knownStation);
    return knownStation === undefined || isOutdated(knownStation, untracked(this.today))
      ? stationIdentifier
      : undefined;
  });
  private readonly stationLoadedAt = injectLoadedAt(this.stationResource);
  private readonly isOnline = inject(NetworkStatus).isOnline;
  private readonly shareSheet = inject(SHARE);
  private readonly document = inject(DOCUMENT);
  private readonly logger = inject(Logger);

  /**
   * The loaded station, else the known one. It stays when a new search leaves the station out,
   * and never shows the previous station while the next one loads.
   */
  private readonly shownStation = linkedSignal<ShownStation, KnownStation | undefined>({
    source: () => {
      const loadedStation = resourceValueOr(this.stationResource, undefined);
      return {
        stationIdentifier: this.id(),
        knownStation:
          loadedStation === undefined
            ? this.knownStation()
            : { station: loadedStation, loadedAt: this.stationLoadedAt() },
      };
    },
    computation: ({ stationIdentifier, knownStation }, previous) => {
      if (knownStation?.station.id === stationIdentifier) {
        return knownStation;
      }
      const previousStation: KnownStation | undefined = previous?.value;
      return previousStation?.station.id === stationIdentifier ? previousStation : undefined;
    },
  });
  protected readonly station = computed(() => this.shownStation()?.station);
  protected readonly fuelType = inject(SettingsStore).fuelType;
  protected readonly isLoading = this.stationResource.isLoading;
  protected readonly errorMessage = computed(() => {
    const error = this.stationResource.error();
    return error === undefined
      ? undefined
      : describeStationsError(error, { isOnline: this.isOnline() });
  });
  protected readonly isFavorite = computed(() => this.favorites.isFavorite(this.id()));
  protected readonly canShare = this.shareSheet !== undefined;
  /** Route and Favorit, and Teilen where `StationDetail` offers it. */
  protected readonly skeletonTiles = this.canShare ? [0, 1, 2] : [0, 1];
  protected readonly showsColdStartHint = injectShowsColdStartHint(this.isLoading);
  /** Set a task after the first render, once the empty status region is in the document. */
  private readonly isLoadingStatusReady = signal(false);
  protected readonly announcesLoading = computed(
    () => this.isLoadingStatusReady() && this.isLoading() && this.station() === undefined
  );
  protected readonly coldStartHint = COLD_START_HINT;

  constructor() {
    reloadWhenReconnected(this.stationResource);
    const openedStation = inject(OpenedStationStore);
    effect(() => {
      const shownStation = this.shownStation();
      if (shownStation === undefined) {
        openedStation.close();
      } else {
        openedStation.open(shownStation.station, shownStation.loadedAt);
      }
    });
    const destroyRef = inject(DestroyRef);
    destroyRef.onDestroy(() => {
      openedStation.close();
    });
    afterNextRender(() => {
      const timer = setTimeout(() => {
        this.isLoadingStatusReady.set(true);
      });
      destroyRef.onDestroy(() => {
        clearTimeout(timer);
      });
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

  protected retry(): void {
    this.stationResource.reload();
  }

  protected toggleFavorite(): void {
    this.favorites.toggle(this.id());
  }

  /** Shares name, address and the link of this card through the system share sheet. */
  protected share(station: Station): void {
    void this.shareStation(station);
  }

  private async shareStation(station: Station): Promise<void> {
    if (this.shareSheet === undefined) {
      return;
    }
    const path = this.router.serializeUrl(this.router.createUrlTree(stationRoute(station.id)));
    try {
      await this.shareSheet({
        title: stationTitle(station),
        text: addressLinesOf(station).join(', '),
        url: new URL(path, this.document.baseURI).href,
      });
    } catch (error) {
      if (!isShareCanceled(error)) {
        this.logger.error('Sharing the station failed.', error);
      }
    }
  }

  protected close(): void {
    this.closeToExplore();
  }
}
