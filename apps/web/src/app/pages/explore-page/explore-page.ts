import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { ElementRef } from '@angular/core';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { distanceInMeters } from '@genialtanken/contracts';
import type { Coordinates, FuelType, Place, Station } from '@genialtanken/contracts';
import { APPLICATION_NAME } from '../../core/application-name';
import { FavoriteStationsResource } from '../../core/favorites/favorite-stations-resource';
import { FavoritesStore } from '../../core/favorites/favorites-store';
import { FUEL_TYPE_LABELS, fuelTypeOptions } from '../../core/fuel-type-labels';
import { OFFLINE_MESSAGE } from '../../core/http/request-failure-messages';
import { KilometersPipe } from '../../core/formatting/kilometers-pipe';
import { formatKilometers } from '../../core/formatting/number-format';
import { injectCurrentUrl } from '../../core/navigation/current-url';
import {
  FAVORITES_ROUTE_PATH,
  isRouteOpen,
  SETTINGS_ROUTE_PATH,
} from '../../core/navigation/explore-routes';
import { injectOpenedStationIdentifier, stationRoute } from '../../core/navigation/station-route';
import { observeElementHeight } from '../../core/layout/observe-element-height';
import { Viewport } from '../../core/layout/viewport';
import { NetworkStatus } from '../../core/network/network-status';
import { shouldOfferAreaSearch } from '../../core/search-center/area-search';
import type { SearchCenter } from '../../core/search-center/search-center';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { radiusStepsIncluding } from '../../core/settings/radius-steps';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { sortStations } from '../../core/stations/sort-stations';
import { stationTitle } from '../../core/stations/station-display';
import type { SortOrder } from '../../core/stations/sort-stations';
import { ColorSchemeController } from '../../core/theme/color-scheme-controller';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { FavoritesRow } from '../../ui/favorites-row/favorites-row';
import { Icon } from '../../ui/icon/icon';
import { LoadingState } from '../../ui/loading-state/loading-state';
import type { ViewportPadding } from '../../ui/map/map-viewport';
import { PlaceSearchField } from '../../ui/place-search-field/place-search-field';
import { SelectMenu } from '../../ui/select-menu/select-menu';
import { SortOrderControl } from '../../ui/sort-order-control/sort-order-control';
import { StationList } from '../../ui/station-list/station-list';
import { StationsMap } from '../../ui/stations-map/stations-map';
import { injectPlaceSearch } from './place-search';
import { describeEmptyResult, describeResult } from './result-summary';
import { injectSheetFollowsCard, isSameCard } from './sheet-follows-card';
import type { SheetCard } from './sheet-follows-card';

interface SelectionSource {
  stations: readonly Station[];
  center: SearchCenter;
}

const FUEL_TYPE_OPTIONS = fuelTypeOptions('long');

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
    FavoritesRow,
    Icon,
    LoadingState,
    PlaceSearchField,
    RouterLink,
    RouterOutlet,
    SelectMenu,
    SortOrderControl,
    StationList,
    StationsMap,
    KilometersPipe,
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
  private readonly stationsMap = viewChild.required(StationsMap);
  // Optional: an effect reads them before the first render when the page opens with a card.
  private readonly bottomSheet = viewChild(BottomSheet);
  private readonly stationList = viewChild(StationList);
  private readonly favoritesRow = viewChild(FavoritesRow);
  private readonly settingsLink = viewChild<ElementRef<HTMLElement>>('settingsLink');
  private readonly searchOverlay = viewChild.required<ElementRef<HTMLElement>>('searchOverlay');
  private readonly resultSummaryElement =
    viewChild<ElementRef<HTMLElement>>('resultSummaryElement');

  protected readonly applicationName = APPLICATION_NAME;
  protected readonly fuelType = this.settings.fuelType;
  protected readonly fuelLabel = computed(() => FUEL_TYPE_LABELS[this.fuelType()].short);
  protected readonly fuelTypeOptions = FUEL_TYPE_OPTIONS;
  protected readonly radiusInKilometers = this.settings.radiusInKilometers;
  protected readonly radiusOptions = computed(() =>
    radiusStepsIncluding(this.radiusInKilometers()).map(radius => ({
      value: radius,
      label: formatKilometers(radius),
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

  private readonly placeSearch = injectPlaceSearch();
  protected readonly placeQuery = this.placeSearch.query;
  protected readonly placeSearchPlaceholder = computed(() =>
    this.isAtOwnPosition() ? this.center().label : 'Position auf Karte'
  );
  protected readonly placeSuggestions = this.placeSearch.suggestions;
  protected readonly placeSearchStatus = this.placeSearch.statusMessage;
  protected readonly locationErrorMessage = this.searchCenter.locationErrorMessage;
  private readonly isOnline = inject(NetworkStatus).isOnline;
  protected readonly offlineMessage = computed(() =>
    this.isOnline() ? undefined : OFFLINE_MESSAGE
  );
  /** While offline the notice explains every failed request, so no error shows next to it. */
  protected readonly stationsErrorMessage = computed(() =>
    this.isOnline() ? this.nearbyStations.errorMessage() : undefined
  );
  protected readonly isLoading = this.nearbyStations.isLoading;
  protected readonly hasLoaded = this.nearbyStations.hasLoaded;
  protected readonly mapStations = this.nearbyStations.stations;
  protected readonly cheapestStationIdentifiers = this.nearbyStations.cheapestStationIdentifiers;
  protected readonly favoriteStationIdentifiers = this.favorites.favoriteStationIdentifierSet;
  protected readonly colorScheme = inject(ColorSchemeController).resolvedScheme;

  protected readonly sortOrder = signal<SortOrder>('distance');
  protected readonly stations = computed(() =>
    sortStations(this.nearbyStations.stations(), this.sortOrder(), this.fuelType())
  );

  protected readonly resultSummary = computed(() => {
    if (!this.hasLoaded()) {
      return '';
    }
    const stationCount = this.mapStations().length;
    return stationCount === 0
      ? describeEmptyResult(this.fuelLabel(), this.radiusInKilometers())
      : describeResult(stationCount, this.radiusInKilometers(), this.center());
  });

  private readonly router = inject(Router);
  private readonly openedStation = inject(OpenedStationStore).station;

  private readonly currentUrl = injectCurrentUrl();
  /** Station whose card is open in the sheet: the child route `stations/:id`. */
  protected readonly openedStationIdentifier = injectOpenedStationIdentifier();
  /** Shown in the sheet instead of the list: a station's card or all favorites. */
  private readonly openedCard = computed<SheetCard | undefined>(
    () => {
      const stationIdentifier = this.openedStationIdentifier();
      if (stationIdentifier !== undefined) {
        return { kind: 'station', stationIdentifier };
      }
      return isRouteOpen(this.currentUrl(), FAVORITES_ROUTE_PATH)
        ? { kind: 'favorites' }
        : undefined;
    },
    { equal: isSameCard }
  );
  protected readonly isCardOpen = computed(() => this.openedCard() !== undefined);
  /** The settings open as a dialog over the page: the child route `settings`. */
  private readonly isSettingsOpen = computed(() =>
    isRouteOpen(this.currentUrl(), SETTINGS_ROUTE_PATH)
  );
  protected readonly settingsRoute = `/${SETTINGS_ROUTE_PATH}`;

  private readonly favoriteStations = inject(FavoriteStationsResource).stations;
  /** Distances from the search center, like the rows of the list. */
  protected readonly favoriteStationsNearby = computed(() => {
    const center = this.center();
    return this.favoriteStations().map(station => ({
      ...station,
      distanceInMeters: distanceInMeters(center, station.address),
    }));
  });

  /**
   * Chosen in the list or on the map. Cleared when the search center changes or the station is
   * no longer in the results.
   */
  private readonly listSelectedStationIdentifier = linkedSignal<
    SelectionSource,
    string | undefined
  >({
    source: () => ({ stations: this.nearbyStations.stations(), center: this.center() }),
    computation: (source, previous) => {
      const previousStationIdentifier = previous?.value;
      if (previousStationIdentifier === undefined || previous?.source.center !== source.center) {
        return undefined;
      }
      return source.stations.some(station => station.id === previousStationIdentifier)
        ? previousStationIdentifier
        : undefined;
    },
  });
  /** An open card wins: its station is the one shown on the map. */
  protected readonly selectedStationIdentifier = computed(
    () => this.openedStationIdentifier() ?? this.listSelectedStationIdentifier()
  );

  protected readonly snapPosition = signal<SnapPosition>('half');
  private readonly sheetHeightInPixels = signal(0);
  protected readonly isSearchCoveredBySheet = computed(
    () => this.isCompactViewport() && this.snapPosition() === 'full'
  );
  private readonly searchOverlayHeightInPixels = observeElementHeight(
    () => this.searchOverlay().nativeElement
  );
  protected readonly mapViewportPadding = computed<ViewportPadding>(() => ({
    top: this.searchOverlayHeightInPixels(),
    right: 0,
    bottom: this.sheetHeightInPixels(),
    left: 0,
  }));

  constructor() {
    injectSheetFollowsCard({
      openedCard: this.openedCard,
      bottomSheet: this.bottomSheet,
      stationList: this.stationList,
      snapPosition: this.snapPosition,
      selectInList: stationIdentifier => {
        this.listSelectedStationIdentifier.set(stationIdentifier);
      },
      focusInsteadOfRow: closedCard => {
        if (closedCard.kind === 'favorites' && this.favoritesRow()?.focusAllLink() === true) {
          return;
        }
        this.resultSummaryElement()?.nativeElement.focus({ preventScroll: true });
      },
    });
    this.showOpenedStationOnMap();
    this.focusSettingsLinkAfterSettings();
  }

  /**
   * The dialog returns the focus to what opened it, but not when it was the first thing shown
   * (deep link) or the browser's back button closed it. The settings link is where it opens again.
   */
  private focusSettingsLinkAfterSettings(): void {
    const injector = inject(Injector);
    let wasSettingsOpen = false;
    effect(() => {
      const isSettingsOpen = this.isSettingsOpen();
      const hasClosed = wasSettingsOpen && !isSettingsOpen;
      wasSettingsOpen = isSettingsOpen;
      if (!hasClosed || untracked(this.isCardOpen)) {
        return;
      }
      afterNextRender(
        () => {
          this.settingsLink()?.nativeElement.focus({ preventScroll: true });
        },
        { injector }
      );
    });
  }

  /**
   * A card can open a station outside the results (e.g. from the favorites); the search then
   * moves there, so the map shows it. Once per station, so a station without a price for the
   * chosen fuel does not move the search again and again.
   */
  private showOpenedStationOnMap(): void {
    let movedForStationIdentifier: string | undefined;
    effect(() => {
      const station = this.openedStation();
      if (
        station === undefined ||
        station.id !== this.openedStationIdentifier() ||
        !this.hasLoaded() ||
        station.id === movedForStationIdentifier
      ) {
        return;
      }
      if (this.nearbyStations.stations().some(nearby => nearby.id === station.id)) {
        return;
      }
      movedForStationIdentifier = station.id;
      untracked(() => {
        this.searchCenter.useStation({
          latitude: station.address.latitude,
          longitude: station.address.longitude,
          label: stationTitle(station),
        });
      });
    });
  }

  /** On phones the sheet steps aside while typing, so the suggestions stay visible. */
  protected searchPlaces(query: string): void {
    this.placeSearch.search(query);
    if (this.isCompactViewport()) {
      this.snapPosition.set('peek');
    }
  }

  protected choosePlace(place: Place): void {
    this.placeSearch.choose(place);
  }

  protected clearPlace(): void {
    this.placeSearch.clear();
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

  protected dismissLocationError(): void {
    this.searchCenter.dismissLocationError();
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

  protected toggleFavorite(stationIdentifier: string): void {
    this.favorites.toggle(stationIdentifier);
  }

  /** A price tag on the map was chosen: the sheet shows its row and leaves the map visible. */
  protected selectFromMap(stationIdentifier: string): void {
    // With a card open, the chosen price tag opens its own card instead, like in Apple Maps.
    if (this.isCardOpen()) {
      void this.router.navigate(stationRoute(stationIdentifier));
      return;
    }
    this.listSelectedStationIdentifier.set(stationIdentifier);
    if (this.isCompactViewport()) {
      this.snapPosition.set('half');
    }
  }

  /**
   * A row of the list was chosen: its pin is centered on the map, again when it was already
   * selected. A fully opened sheet steps down to half, so pin and row are both visible.
   */
  protected showOnMap(stationIdentifier: string): void {
    if (this.selectedStationIdentifier() === stationIdentifier) {
      this.stationsMap().revealSelectedStation();
    }
    this.listSelectedStationIdentifier.set(stationIdentifier);
    if (this.isCompactViewport() && this.snapPosition() === 'full') {
      this.snapPosition.set('half');
    }
  }

  protected updateSheetHeight(heightInPixels: number): void {
    this.sheetHeightInPixels.set(heightInPixels);
  }
}
