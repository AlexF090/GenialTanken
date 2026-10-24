import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { Router, RouterLink, RouterOutlet } from '@angular/router';
import { distanceInMeters } from '@genialtanken/contracts';
import type { Coordinates, FuelType, Place, Station } from '@genialtanken/contracts';
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
import { MAIN_CONTENT_IDENTIFIER } from '../../core/navigation/main-content';
import { injectOpenedStationIdentifier, stationRoute } from '../../core/navigation/station-route';
import { InstallationHint } from '../../core/installation/installation-hint';
import { observeElementBounds } from '../../core/layout/observe-element-bounds';
import { Viewport } from '../../core/layout/viewport';
import { injectViewportGapBottom } from '../../core/layout/viewport-gap';
import { injectKeyboardInset } from '../../core/layout/visual-viewport';
import { NetworkStatus } from '../../core/network/network-status';
import { shouldOfferAreaSearch } from '../../core/search-center/area-search';
import type { SearchCenter } from '../../core/search-center/search-center';
import { SearchCenterStore } from '../../core/search-center/search-center-store';
import { radiusStepsIncluding } from '../../core/settings/radius-steps';
import { SettingsStore } from '../../core/settings/settings-store';
import { NearbyStationsStore } from '../../core/stations/nearby-stations-store';
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { SORT_ORDER_LABELS, SORT_ORDER_OPTIONS } from '../../core/stations/sort-order-options';
import { sortStations } from '../../core/stations/sort-stations';
import { stationTitle } from '../../core/stations/station-display';
import type { SortOrder } from '../../core/stations/sort-stations';
import { ColorSchemeController } from '../../core/theme/color-scheme-controller';
import { BottomSheet } from '../../ui/bottom-sheet/bottom-sheet';
import type { SnapPosition } from '../../ui/bottom-sheet/bottom-sheet-snap';
import { DataSourceCredit } from '../../ui/data-source-credit/data-source-credit';
import { FavoritesRow } from '../../ui/favorites-row/favorites-row';
import { FilterChip } from '../../ui/filter-chip/filter-chip';
import { Icon } from '../../ui/icon/icon';
import { Wordmark } from '../../ui/wordmark/wordmark';
import { InstallationHintBanner } from '../../ui/installation-hint-banner/installation-hint-banner';
import { SkeletonRows } from '../../ui/skeleton-rows/skeleton-rows';
import { isSameViewportPadding } from '../../ui/map/map-viewport';
import type { ViewportPadding } from '../../ui/map/map-viewport';
import { PlaceSearchField } from '../../ui/place-search-field/place-search-field';
import { ResultSummaryLine } from '../../ui/result-summary-line/result-summary-line';
import { StationList } from '../../ui/station-list/station-list';
import { StationsMap } from '../../ui/stations-map/stations-map';
import { BrowserEdgeTint } from '../../ui/browser-edge-tint/browser-edge-tint';
import { ZoomControls } from '../../ui/zoom-controls/zoom-controls';
import { recoverFocusWhenChanged } from './focus-recovery';
import { mapViewportPaddingFor } from './map-viewport-padding';
import { injectPlaceSearch } from './place-search';
import { describeEmptyResult, describeResult, describeResultBriefly } from './result-summary';
import { injectSearchMode } from './search-mode';
import { focusSettingsLinkAfterSettings } from './settings-link-focus';
import { injectSheetFollowsCard, isSameCard } from './sheet-follows-card';
import type { SheetCard } from './sheet-follows-card';

interface SelectionSource {
  stations: readonly Station[];
  center: SearchCenter;
}

const FUEL_TYPE_OPTIONS = fuelTypeOptions('long');

/** The installation hint follows the first stations, so it never hides the nearest ones. */
const INSTALLATION_HINT_AFTER_ROW = 3;

/**
 * Start page: stations around the search center as a price board and on a map. The map fills
 * the window, under the system bars too; on phones the list is a bottom sheet over it, from 48rem
 * a floating side panel. List and map share one selection.
 */
@Component({
  selector: 'app-explore-page',
  imports: [
    BottomSheet,
    DataSourceCredit,
    FavoritesRow,
    FilterChip,
    Icon,
    InstallationHintBanner,
    NgTemplateOutlet,
    PlaceSearchField,
    ResultSummaryLine,
    RouterLink,
    RouterOutlet,
    SkeletonRows,
    StationList,
    StationsMap,
    KilometersPipe,
    Wordmark,
    ZoomControls,
    BrowserEdgeTint,
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
  protected readonly isCompactViewport = inject(Viewport).isCompactViewport;
  private readonly stationsMap = viewChild.required(StationsMap);
  // Optional: an effect reads them before the first render when the page opens with a card.
  private readonly bottomSheet = viewChild(BottomSheet);
  private readonly stationList = viewChild(StationList);
  private readonly favoritesRow = viewChild(FavoritesRow);
  private readonly dataSourceCredit = viewChild.required(DataSourceCredit);
  private readonly settingsLink = viewChild<ElementRef<HTMLElement>>('settingsLink');
  private readonly locateButton = viewChild.required<ElementRef<HTMLElement>>('locateButton');
  private readonly mapControls = viewChild.required<ElementRef<HTMLElement>>('mapControls');
  private readonly panel = viewChild.required<string, ElementRef<HTMLElement>>('panel', {
    read: ElementRef<HTMLElement>,
  });
  private readonly resultSummaryLine = viewChild(ResultSummaryLine);

  protected readonly mainContentIdentifier = MAIN_CONTENT_IDENTIFIER;
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
  protected readonly sortOrderOptions = SORT_ORDER_OPTIONS;
  protected readonly sortOrderLabel = computed(() => SORT_ORDER_LABELS[this.sortOrder()]);
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
  protected readonly briefResultSummary = computed(() => {
    const stationCount = this.mapStations().length;
    return stationCount === 0
      ? this.resultSummary()
      : describeResultBriefly(stationCount, this.radiusInKilometers());
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

  private readonly favoriteStationsResource = inject(FavoriteStationsResource);
  private readonly favoriteStations = this.favoriteStationsResource.stations;
  protected readonly favoritesAreLoading = this.favoriteStationsResource.isLoading;
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
  private readonly searchMode = injectSearchMode({
    snapPosition: this.snapPosition,
    focusAfterSearch: () => {
      this.focusResultSummary();
    },
  });
  protected readonly isSearching = this.searchMode.isSearching;
  protected readonly contentDragsSheet = computed(
    () => !this.isSearching() && this.openedStationIdentifier() === undefined
  );
  protected readonly areMapControlsCovered = computed(
    () => this.isCompactViewport() && this.snapPosition() === 'full'
  );
  private readonly mapControlsBounds = observeElementBounds(() => this.mapControls().nativeElement);
  private readonly panelBounds = observeElementBounds(() => this.panel().nativeElement);
  protected readonly mapViewportPadding = computed<ViewportPadding>(
    () =>
      mapViewportPaddingFor({
        isCompactViewport: this.isCompactViewport(),
        mapControlsBottom: this.mapControlsBounds().bottom,
        sheetHeight: this.sheetHeightInPixels(),
        panelRight: this.panelBounds().right,
      }),
    { equal: isSameViewportPadding }
  );

  private readonly installationHint = inject(InstallationHint);
  protected readonly installationOffer = this.installationHint.offer;
  protected readonly isLoadingFirstStations = computed(
    () => this.isLoading() && this.stations().length === 0
  );
  protected readonly showsInstallationHint = computed(
    () => this.installationOffer() !== undefined && !this.isLoadingFirstStations()
  );
  /** Only a shown hint splits the list. */
  protected readonly installationHintAfterRow = computed(() =>
    this.showsInstallationHint() ? INSTALLATION_HINT_AFTER_ROW : undefined
  );

  constructor() {
    injectKeyboardInset();
    injectViewportGapBottom();
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
        this.focusResultSummary();
      },
    });
    this.showOpenedStationOnMap();
    focusSettingsLinkAfterSettings({
      isSettingsOpen: this.isSettingsOpen,
      isCardOpen: this.isCardOpen,
      settingsLink: () => this.settingsLink()?.nativeElement,
    });
    // Closing a notice removes its focused button; the focus returns to where the notice belongs.
    recoverFocusWhenChanged(this.locationErrorMessage, () => {
      this.locateButton().nativeElement.focus({ preventScroll: true });
    });
    // Continues right after the closed hint: at the station below it, or at the credit.
    recoverFocusWhenChanged(this.installationOffer, () => {
      const nextStation = this.stations()[INSTALLATION_HINT_AFTER_ROW];
      if (nextStation !== undefined && this.stationList()?.focusStation(nextStation.id) === true) {
        return;
      }
      this.dataSourceCredit().focusLink();
    });
  }

  private focusResultSummary(): void {
    this.resultSummaryLine()?.focusSummary();
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

  protected startSearch(): void {
    this.searchMode.start();
  }

  protected searchPlaces(query: string): void {
    this.searchMode.start();
    this.placeSearch.search(query);
  }

  /** "Abbrechen" or Escape: the field shows the search center again. */
  protected cancelSearch(): void {
    this.placeSearch.cancel();
    this.searchMode.cancel();
  }

  protected choosePlace(place: Place): void {
    this.placeSearch.choose(place);
    this.searchMode.finishWithChoice();
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

  /** At the end of the zoom range the buttons stay focusable but do nothing, like the map's own. */
  protected readonly canZoomIn = computed(() => this.stationsMap().canZoomIn());
  protected readonly canZoomOut = computed(() => this.stationsMap().canZoomOut());

  protected zoomIn(): void {
    if (this.canZoomIn()) {
      this.stationsMap().zoomIn();
    }
  }

  protected zoomOut(): void {
    if (this.canZoomOut()) {
      this.stationsMap().zoomOut();
    }
  }

  protected installApplication(): void {
    void this.installationHint.install();
  }

  protected dismissInstallationHint(): void {
    this.installationHint.dismiss();
  }

  protected updateSheetHeight(heightInPixels: number): void {
    this.sheetHeightInPixels.set(heightInPixels);
  }
}
