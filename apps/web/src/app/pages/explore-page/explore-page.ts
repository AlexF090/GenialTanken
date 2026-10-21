import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  debounced,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  linkedSignal,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, PRIMARY_OUTLET, Router, RouterOutlet } from '@angular/router';
import type { UrlTree } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
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
import { OpenedStationStore } from '../../core/stations/opened-station-store';
import { sortStations } from '../../core/stations/sort-stations';
import { stationTitle } from '../../core/stations/station-display';
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

/** `/stations/<id>` opens the card of a station. */
const stationIdIn = (url: UrlTree | undefined): string | undefined => {
  const segments = url?.root.children[PRIMARY_OUTLET]?.segments ?? [];
  return segments.length === 2 && segments[0]?.path === 'stations' ? segments[1]?.path : undefined;
};

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
    RouterOutlet,
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
  private readonly stationsMap = viewChild.required(StationsMap);
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

  private readonly router = inject(Router);
  private readonly openedStation = inject(OpenedStationStore).station;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly injector = inject(Injector);

  /** Station whose card is open in the sheet: the child route `stations/:id`. */
  protected readonly openedStationId = toSignal(
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd),
      map(event => this.router.parseUrl(event.urlAfterRedirects)),
      // The page is created during the navigation to it, before its `NavigationEnd`.
      startWith(this.router.currentNavigation()?.finalUrl ?? this.router.parseUrl(this.router.url)),
      map(stationIdIn)
    ),
    { initialValue: undefined }
  );
  protected readonly isStationCardOpen = computed(() => this.openedStationId() !== undefined);

  /**
   * Chosen in the list or on the map. Cleared when the search center changes or the station is
   * no longer in the results.
   */
  private readonly listSelectedStationId = linkedSignal<SelectionSource, string | undefined>({
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
  /** An open card wins: its station is the one shown on the map. */
  protected readonly selectedStationId = computed(
    () => this.openedStationId() ?? this.listSelectedStationId()
  );

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

    this.followStationCard();
    this.showOpenedStationOnMap();
  }

  /**
   * Opening a card shows it from its top and lifts a peeking sheet; closing it returns to the list
   * where it was, with the station still selected and focused.
   */
  private followStationCard(): void {
    let previousStationId: string | undefined;
    let listScrollTop = 0;
    effect(() => {
      const stationId = this.openedStationId();
      const closedStationId = previousStationId;
      previousStationId = stationId;
      if (stationId === closedStationId) {
        return;
      }
      untracked(() => {
        const scroller = this.host.querySelector<HTMLElement>('.bottom-sheet__content');
        if (stationId !== undefined) {
          if (closedStationId === undefined) {
            listScrollTop = scroller?.scrollTop ?? 0;
          }
          if (scroller !== null) {
            scroller.scrollTop = 0;
          }
          if (this.isCompactViewport() && this.snapPosition() === 'peek') {
            this.snapPosition.set('half');
          }
          return;
        }
        if (closedStationId === undefined) {
          return;
        }
        this.listSelectedStationId.set(closedStationId);
        afterNextRender(
          () => {
            if (scroller !== null) {
              scroller.scrollTop = listScrollTop;
            }
            this.host
              .querySelector<HTMLElement>(
                `[data-station-id="${CSS.escape(closedStationId)}"] .station-row__title`
              )
              ?.focus({ preventScroll: true });
          },
          { injector: this.injector }
        );
      });
    });
  }

  /**
   * A card can open a station outside the results (e.g. from the favorites); the search then
   * moves there, so the map shows it. Once per station, so a station without a price for the
   * chosen fuel does not move the search again and again.
   */
  private showOpenedStationOnMap(): void {
    let movedForStationId: string | undefined;
    effect(() => {
      const station = this.openedStation();
      if (
        station === undefined ||
        station.id !== this.openedStationId() ||
        !this.hasLoaded() ||
        station.id === movedForStationId
      ) {
        return;
      }
      if (this.nearbyStations.stations().some(nearby => nearby.id === station.id)) {
        return;
      }
      movedForStationId = station.id;
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

  protected toggleFavorite(stationId: string): void {
    this.favorites.toggle(stationId);
  }

  /** A price tag on the map was chosen: the sheet shows its row and leaves the map visible. */
  protected selectFromMap(stationId: string): void {
    // With a card open, the chosen price tag opens its own card instead, like in Apple Maps.
    if (this.isStationCardOpen()) {
      void this.router.navigate(['/stations', stationId]);
      return;
    }
    this.listSelectedStationId.set(stationId);
    if (this.isCompactViewport()) {
      this.snapPosition.set('half');
    }
  }

  /**
   * A row of the list was chosen: its pin is centered on the map, again when it was already
   * selected. A fully opened sheet steps down to half, so pin and row are both visible.
   */
  protected showOnMap(stationId: string): void {
    if (this.selectedStationId() === stationId) {
      this.stationsMap().revealSelectedStation();
    }
    this.listSelectedStationId.set(stationId);
    if (this.isCompactViewport() && this.snapPosition() === 'full') {
      this.snapPosition.set('half');
    }
  }

  protected updateSheetHeight(heightInPixels: number): void {
    this.sheetHeightInPixels.set(heightInPixels);
  }
}
