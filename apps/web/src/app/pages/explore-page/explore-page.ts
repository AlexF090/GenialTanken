import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  debounced,
  DestroyRef,
  inject,
  linkedSignal,
  signal,
  viewChild,
} from '@angular/core';
import { FUEL_TYPES } from '@genialtanken/contracts';
import type { FuelType, Place, Station } from '@genialtanken/contracts';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS } from '../../core/fuel-type-labels';
import type { Coordinates } from '../../core/geolocation/coordinates';
import { Viewport } from '../../core/layout/viewport';
import { PlacesApi } from '../../core/places/places-api';
import { describePlacesError } from '../../core/places/places-error-message';
import { shouldOfferAreaSearch } from '../../core/search-center/area-search';
import type { SearchCenter } from '../../core/search-center/search-center';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { radiusStepsIncluding } from '../../core/settings/radius-steps';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { sortStations } from '../../core/stations/sort-stations';
import type { SortOrder } from '../../core/stations/sort-stations';
import { ColorSchemeController } from '../../core/theme/color-scheme-controller';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import { PlaceSearchField } from '../../ui/place-search-field/place-search-field';
import { SelectMenu } from '../../ui/select-menu/select-menu';
import type { SelectMenuOption } from '../../ui/select-menu/select-menu';
import { SortOrderControl } from '../../ui/sort-order-control/sort-order-control';
import { StationList } from '../../ui/station-list/station-list';
import { StationsMap } from '../../ui/stations-map/stations-map';
import type { ViewportPadding } from '../../ui/stations-map/stations-map';

interface SelectionSource {
  stations: readonly Station[];
  center: SearchCenter;
}

const FUEL_TYPE_OPTIONS: readonly SelectMenuOption<FuelType>[] = FUEL_TYPES.map(fuelType => ({
  value: fuelType,
  label: FUEL_TYPE_LABELS[fuelType].long,
}));

/** Waiting for a typing pause keeps the place search from firing on every keystroke. */
export const PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS = 300;

const NO_MATCHING_PLACES_MESSAGE = 'Keine passenden Orte gefunden.';

const waitForTypingPause = (query: string | undefined): Promise<void> | undefined =>
  query === undefined
    ? undefined
    : new Promise(resolve => setTimeout(resolve, PLACE_SEARCH_DEBOUNCE_IN_MILLISECONDS));

const describeCenter = (center: SearchCenter): string =>
  center.source === 'map-area' ? 'die Kartenmitte' : center.label;

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
    DataSourceCredit,
    Icon,
    LoadingState,
    PlaceSearchField,
    SelectMenu,
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
  private readonly searchOverlay = viewChild.required<ElementRef<HTMLElement>>('searchOverlay');

  protected readonly fuelType = this.settings.fuelType;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly fuelTypeOptions = FUEL_TYPE_OPTIONS;
  protected readonly radiusInKilometers = this.settings.radiusInKilometers;
  protected readonly radiusOptions = computed(() =>
    radiusStepsIncluding(this.radiusInKilometers()).map(radius => ({
      value: radius,
      label: `${String(radius)}\u00a0km`,
    }))
  );
  protected readonly center = this.searchCenter.center;
  protected readonly isLocating = this.searchCenter.isLocating;
  /** Where the user moved the map to; forgotten whenever the search center changes. */
  private readonly visibleMapCenter = linkedSignal<SearchCenter, Coordinates | undefined>({
    source: this.center,
    computation: () => undefined,
  });
  protected readonly isAreaSearchOffered = computed(() =>
    shouldOfferAreaSearch(this.center(), this.visibleMapCenter(), this.radiusInKilometers())
  );
  protected readonly isAtOwnPosition = computed(() => this.center().source === 'own-position');

  /** Text in the search field: the chosen place, or what the user is typing. */
  protected readonly placeQuery = linkedSignal(() => {
    const center = this.center();
    return center.source === 'place' ? center.label : '';
  });
  protected readonly placeSearchPlaceholder = computed(() =>
    this.isAtOwnPosition() ? this.center().label : 'Position auf Karte'
  );
  /** Only typed text is searched, not the name of a place that was just chosen. */
  private readonly isTypingPlaceQuery = signal(false);
  private readonly placeQueryAfterTypingPause = debounced(
    () => (this.isTypingPlaceQuery() ? this.placeQuery() : undefined),
    waitForTypingPause
  );
  private readonly placesResource = inject(PlacesApi).placesMatching(() =>
    this.placeQueryAfterTypingPause.hasValue() ? this.placeQueryAfterTypingPause.value() : undefined
  );
  protected readonly placeSuggestions = computed<readonly Place[]>(() =>
    this.isTypingPlaceQuery() && this.placesResource.hasValue() ? this.placesResource.value() : []
  );
  protected readonly placeSearchStatus = computed(() => {
    if (!this.isTypingPlaceQuery()) {
      return undefined;
    }
    const error = this.placesResource.error();
    if (error !== undefined) {
      return describePlacesError(error);
    }
    const hasNoMatches =
      this.placesResource.status() === 'resolved' && this.placesResource.value()?.length === 0;
    return hasNoMatches ? NO_MATCHING_PLACES_MESSAGE : undefined;
  });
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
      ? `${describeStationCount(this.mapStations().length)} im Umkreis von ${String(this.radiusInKilometers())}\u00a0km um ${describeCenter(this.center())}`
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
  protected readonly isSearchCoveredBySheet = computed(
    () => this.isCompactViewport() && this.snapPosition() === 'full'
  );
  private readonly searchOverlayHeightInPixels = signal(0);
  protected readonly mapViewportPadding = computed<ViewportPadding>(() => ({
    top: this.searchOverlayHeightInPixels(),
    right: 0,
    bottom: this.sheetHeightInPixels(),
    left: 0,
  }));

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      // jsdom (unit tests) has no ResizeObserver; the map then ignores the search overlay.
      if (typeof ResizeObserver !== 'function') {
        return;
      }
      const searchOverlay = this.searchOverlay().nativeElement;
      const observer = new ResizeObserver(() => {
        this.searchOverlayHeightInPixels.set(searchOverlay.offsetHeight);
      });
      observer.observe(searchOverlay);
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
    });
  }

  /** On phones the sheet steps aside while typing, so the suggestions stay visible. */
  protected searchPlaces(query: string): void {
    this.placeQuery.set(query);
    this.isTypingPlaceQuery.set(true);
    if (this.isCompactViewport()) {
      this.snapPosition.set('peek');
    }
  }

  protected choosePlace(place: Place): void {
    this.isTypingPlaceQuery.set(false);
    this.searchCenter.usePlace(place);
  }

  /** Clearing the search keeps the stations around the same point, just without the place name. */
  protected clearPlace(): void {
    this.isTypingPlaceQuery.set(false);
    if (this.center().source === 'place') {
      this.searchCenter.useMapArea(this.center());
    }
  }

  protected updateVisibleMapCenter(visibleMapCenter: Coordinates): void {
    this.visibleMapCenter.set(visibleMapCenter);
  }

  protected searchVisibleArea(): void {
    const visibleMapCenter = this.visibleMapCenter();
    if (visibleMapCenter !== undefined) {
      this.searchCenter.useMapArea(visibleMapCenter);
    }
  }

  protected chooseRadius(radiusInKilometers: number): void {
    this.settings.update({ radiusInKilometers });
  }

  protected useOwnPosition(): void {
    if (this.isLocating()) {
      return;
    }
    void this.searchCenter.useOwnPosition();
  }

  protected chooseFuelType(fuelType: FuelType): void {
    this.settings.update({ fuelType });
  }

  protected refresh(): void {
    this.nearbyStations.refresh();
  }

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }

  /** A price tag on the map was chosen: the sheet shows its row and leaves the map visible. */
  protected selectFromMap(stationId: string): void {
    this.selectedStationId.set(stationId);
    if (this.isCompactViewport()) {
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
