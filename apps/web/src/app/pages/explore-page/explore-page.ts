import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { Station } from '@genialtanken/contracts';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import { Viewport } from '../../core/layout/viewport';
import type { SearchCenter } from '../../core/search-center/search-center';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { sortStations } from '../../core/stations/sort-stations';
import type { SortOrder } from '../../core/stations/sort-stations';
import { ColorSchemeController } from '../../core/theme/color-scheme-controller';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { SortOrderControl } from '../../ui/sort-order-control/sort-order-control';
import { StationList } from '../../ui/station-list/station-list';
import { StationsMap } from '../../ui/stations-map/stations-map';
import type { ViewportPadding } from '../../ui/stations-map/stations-map';

interface SelectionSource {
  stations: readonly Station[];
  center: SearchCenter;
}

const describeStationCount = (count: number): string =>
  count === 1 ? '1 Tankstelle' : `${String(count)} Tankstellen`;

/**
 * Start page: stations around the search center as a price board and on a map. On phones the
 * list is a bottom sheet over a full-screen map; from 48rem it is a side panel next to the map.
 * List and map share one selection.
 */
@Component({
  selector: 'app-explore-page',
  imports: [
    BottomSheet,
    Icon,
    LoadingState,
    RouterLink,
    SortOrderControl,
    StationList,
    StationsMap,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './explore-page.html',
  styleUrl: './explore-page.scss',
})
export class ExplorePage {
  private readonly nearbyStations = inject(NearbyStationsStore);
  private readonly searchCenter = inject(SearchCenterStore);
  private readonly settings = inject(SettingsStore);
  private readonly favorites = inject(FavoritesStore);
  private readonly isCompactViewport = inject(Viewport).isCompactViewport;

  protected readonly fuelType = this.settings.fuelType;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly radiusInKilometers = this.settings.radiusInKilometers;
  protected readonly center = this.searchCenter.center;
  protected readonly isLocating = this.searchCenter.isLocating;
  protected readonly locationErrorMessage = this.searchCenter.locationErrorMessage;
  protected readonly stationsErrorMessage = this.nearbyStations.errorMessage;
  protected readonly isLoading = this.nearbyStations.isLoading;
  protected readonly hasLoaded = this.nearbyStations.hasLoaded;
  protected readonly mapStations = this.nearbyStations.stations;
  protected readonly cheapestStationIds = this.nearbyStations.cheapestStationIds;
  protected readonly favoriteStationIds = this.favorites.favoriteStationIdSet;
  protected readonly colorScheme = inject(ColorSchemeController).resolvedScheme;

  protected readonly sortOrder = signal<SortOrder>('distance');
  protected readonly stations = computed(() =>
    sortStations(this.nearbyStations.stations(), this.sortOrder(), this.fuelType())
  );

  protected readonly resultSummary = computed(() =>
    this.hasLoaded()
      ? `${describeStationCount(this.mapStations().length)} im Umkreis von ${String(this.radiusInKilometers())}\u00a0km um ${this.center().label}`
      : ''
  );

  /** Cleared when the search center changes or the station is no longer in the results. */
  protected readonly selectedStationId = linkedSignal<SelectionSource, string | undefined>({
    source: () => ({ stations: this.nearbyStations.stations(), center: this.center() }),
    computation: (source, previous) => {
      const previousStationId = previous?.value;
      if (previousStationId === undefined || previous?.source.center !== source.center) {
        return undefined;
      }
      return source.stations.some(station => station.id === previousStationId)
        ? previousStationId
        : undefined;
    },
  });

  protected readonly snapPosition = signal<SnapPosition>('half');
  private readonly sheetHeightInPixels = signal(0);
  protected readonly mapViewportPadding = computed<ViewportPadding>(() => ({
    top: 0,
    right: 0,
    bottom: this.sheetHeightInPixels(),
    left: 0,
  }));

  protected useOwnPosition(): void {
    if (this.isLocating()) {
      return;
    }
    void this.searchCenter.useOwnPosition();
  }

  protected refresh(): void {
    this.nearbyStations.refresh();
  }

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }

  /** A price tag on the map was chosen: the sheet opens far enough to show its row. */
  protected selectFromMap(stationId: string): void {
    this.selectedStationId.set(stationId);
    if (this.isCompactViewport() && this.snapPosition() === 'peek') {
      this.snapPosition.set('half');
    }
  }

  /** "Auf Karte zeigen" toggles the selection; the sheet steps aside so the map is visible. */
  protected showOnMap(stationId: string): void {
    if (this.selectedStationId() === stationId) {
      this.selectedStationId.set(undefined);
      return;
    }
    this.selectedStationId.set(stationId);
    if (this.isCompactViewport()) {
      this.snapPosition.set('peek');
    }
  }

  protected updateSheetHeight(heightInPixels: number): void {
    this.sheetHeightInPixels.set(heightInPixels);
  }
}
