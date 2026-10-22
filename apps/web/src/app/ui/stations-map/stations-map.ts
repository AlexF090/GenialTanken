import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Coordinates, FuelType, Station } from '@genialtanken/contracts';
import { observeElementResize } from '../../core/layout/observe-element-resize';
import { injectPrefersReducedMotion } from '../../core/layout/reduced-motion';
import { CONFIGURED_MAPBOX_ACCESS_TOKEN } from '../../core/map/mapbox-access-token';
import type { SearchCenter } from '../../core/search-center/search-center';
import type { ResolvedColorScheme } from '../../core/theme/color-scheme-controller';
import { L } from '../map/leaflet';
import { createCenterMarker, createRadiusCircle } from '../map/leaflet-layers';
import type { StationMarker } from '../map/station-marker';
import { destroyMap } from '../map/map-teardown';
import {
  centerForVisibleArea,
  hasVisibleArea,
  isInVisibleArea,
  isSameViewportPadding,
  NO_VIEWPORT_PADDING,
  searchAreaBounds,
  toPaddingOptions,
  visibleAreaCenter,
} from '../map/map-viewport';
import type { ViewportPadding } from '../map/map-viewport';
import type { MarkerReveal } from '../map/reveal-marker';
import { createTileLayer, MAXIMUM_ZOOM } from '../map/tile-layer';
import { StationMarkerLayer } from './station-marker-layer';
import type { ClusterOpening } from './station-marker-layer';

/** Leaflet's default is unbounded, so a fast swipe flings the map far and for long. */
const INERTIA_MAXIMUM_SPEED_IN_PIXELS_PER_SECOND = 1500;

interface PendingViewUpdate {
  frame: number;
  hasPaddingChanged: boolean;
  hasSizeChanged: boolean;
}

/**
 * Interactive map of the search area: a price tag per station (clustered when close), the search
 * center and the search radius. Selecting a tag reports the station; a selection from outside
 * brings its tag into view.
 */
@Component({
  selector: 'app-stations-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Covered by overlays, the price tags would take focus while hidden.
  template: `<div
    #map
    class="stations-map"
    role="region"
    aria-label="Karte der Tankstellen"
    [attr.inert]="isCoveredByOverlays() ? '' : null"
    (focusin)="bringFocusedMarkerIntoView($event)"></div>`,
  styles: `
    :host {
      position: relative;
      display: block;
    }

    /* Absolute positioning gives Leaflet the size the layout assigned to the host. */
    .stations-map {
      position: absolute;
      inset: 0;
    }
  `,
})
export class StationsMap {
  readonly stations = input.required<readonly Station[]>();
  readonly fuelType = input.required<FuelType>();
  readonly center = input.required<SearchCenter>();
  readonly radiusInKilometers = input.required<number>();
  readonly selectedStationIdentifier = input<string>();
  readonly cheapestStationIdentifiers = input<ReadonlySet<string>>(new Set());
  readonly colorScheme = input<ResolvedColorScheme>('light');
  readonly viewportPadding = input<ViewportPadding>(NO_VIEWPORT_PADDING);
  /** Emitted with the station id when a price tag is clicked or activated with the keyboard. */
  readonly stationSelected = output<string>();
  /** Center of the visible map after the user moved it, e.g. to offer a search there. */
  readonly visibleCenterChanged = output<Coordinates>();

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly container = viewChild.required<ElementRef<HTMLElement>>('map');
  private readonly mapboxAccessToken = inject(CONFIGURED_MAPBOX_ACCESS_TOKEN);
  private readonly prefersReducedMotion = injectPrefersReducedMotion();
  private readonly map = signal<L.Map | undefined>(undefined);
  protected readonly isCoveredByOverlays = signal(false);
  private readonly stationMarkers = new StationMarkerLayer(marker => {
    this.selectFromMap(marker);
  });
  private revealedStationIdentifier: string | undefined;
  private markerReveal: MarkerReveal | undefined;
  private clusterOpening: ClusterOpening | undefined;
  private pendingViewUpdate: PendingViewUpdate | undefined;
  private hasAppliedViewUpdate = false;
  /** Tells the map's own moves from the user's; `moveend` clears it. */
  private isMovingProgrammatically = false;
  /** Set once the user moves or zooms the map; overlay and size changes then keep the view. */
  private hasUserMovedMap = false;
  /** A selected station stays centered while overlays move, until the user moves the map. */
  private hasUserMovedMapSinceReveal = false;

  constructor() {
    const destroyRef = inject(DestroyRef);

    afterNextRender(() => {
      // The cluster group needs a maximum zoom before the first tile layer is added.
      const map = L.map(this.container().nativeElement, {
        zoomControl: false,
        maxZoom: MAXIMUM_ZOOM,
        inertiaMaxSpeed: INERTIA_MAXIMUM_SPEED_IN_PIXELS_PER_SECOND,
      });
      // Every move the map did not start itself is the user's: dragging, pinching, the wheel, the
      // zoom buttons or the arrow keys. A reveal moves the map in steps, one `moveend` apart.
      // Registered before the first fit, whose `moveend` ends that programmatic move.
      map.on('movestart', () => {
        if (!this.isMovingProgrammatically && this.markerReveal?.isPending !== true) {
          this.markUserMovement();
        }
      });
      // A drag stops a running animation of the map's own; it is the user's even then.
      map.on('dragstart', () => {
        this.markUserMovement();
      });
      map.on('moveend', () => {
        this.isMovingProgrammatically = false;
        if (this.hasUserMovedMap) {
          this.visibleCenterChanged.emit(visibleAreaCenter(map, this.viewportPadding()));
        }
      });
      // Leaflet needs a view before layers are added; with no visible space the next update fits.
      if (!this.fitSearchArea(map, { animate: false })) {
        this.moveProgrammatically(() => {
          map.fitBounds(searchAreaBounds(this.center(), this.radiusInKilometers()), {
            animate: false,
          });
        });
      }
      L.control
        .zoom({ position: 'topright', zoomInTitle: 'Hineinzoomen', zoomOutTitle: 'Herauszoomen' })
        .addTo(map);
      this.stationMarkers.addTo(map, ({ cluster, isFromKeyboard }) => {
        this.openCluster(map, cluster, isFromKeyboard);
      });
      observeElementResize(
        [this.host.nativeElement],
        () => {
          this.scheduleViewUpdate(map, 'size');
        },
        destroyRef
      );
      this.map.set(map);
    });

    // The first fit happens before overlays such as the bottom sheet report their size.
    let previousViewportPadding: ViewportPadding | undefined;
    effect(() => {
      const map = this.map();
      const viewportPadding = this.viewportPadding();
      if (map === undefined) {
        return;
      }
      const hasPaddingChanged =
        previousViewportPadding !== undefined &&
        !isSameViewportPadding(previousViewportPadding, viewportPadding);
      previousViewportPadding = viewportPadding;
      if (hasPaddingChanged) {
        this.scheduleViewUpdate(map, 'padding');
      }
    });

    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const tileLayer = createTileLayer(this.mapboxAccessToken, this.colorScheme()).addTo(map);
      onCleanup(() => tileLayer.remove());
    });

    let previousRadiusInKilometers: number | undefined;
    effect(onCleanup => {
      const map = this.map();
      if (map === undefined) {
        return;
      }
      const center = this.center();
      const radiusInKilometers = this.radiusInKilometers();
      const circle = createRadiusCircle(center, radiusInKilometers).addTo(map);
      const centerMarker = createCenterMarker(center).addTo(map);
      onCleanup(() => {
        circle.remove();
        centerMarker.remove();
      });
      // A new search area is a fresh start, even after the user moved the map.
      this.hasUserMovedMap = false;
      const hasRadiusChanged = radiusInKilometers !== previousRadiusInKilometers;
      previousRadiusInKilometers = radiusInKilometers;
      // The user is already looking at an area they moved the map to; fitting would jump.
      if (center.source === 'map-area' && !hasRadiusChanged) {
        return;
      }
      untracked(() => {
        this.fitSearchArea(map, this.motion());
      });
    });

    effect(() => {
      if (this.map() === undefined) {
        return;
      }
      const stations = this.stations();
      const context = {
        fuelType: this.fuelType(),
        cheapestStationIdentifiers: this.cheapestStationIdentifiers(),
        selectedStationIdentifier: untracked(() => this.selectedStationIdentifier()),
      };
      // A reveal still in progress targets a replaced marker; reveal the new one instead.
      if (this.markerReveal?.isPending === true) {
        this.markerReveal.cancel();
        this.revealedStationIdentifier = undefined;
      }
      this.stationMarkers.showStations(stations, context);
    });

    effect(() => {
      const map = this.map();
      const selectedStationIdentifier = this.selectedStationIdentifier();
      if (map === undefined) {
        return;
      }
      this.stationMarkers.select(selectedStationIdentifier);
      if (selectedStationIdentifier === undefined) {
        this.markerReveal?.cancel();
        this.revealedStationIdentifier = undefined;
        return;
      }
      // Revealed once per selection, not again whenever the markers are rebuilt.
      const selectedMarker = this.stationMarkers.markerOf(selectedStationIdentifier);
      if (
        selectedMarker === undefined ||
        selectedStationIdentifier === this.revealedStationIdentifier
      ) {
        return;
      }
      this.revealedStationIdentifier = selectedStationIdentifier;
      untracked(() => {
        this.reveal(map, selectedMarker);
      });
    });

    destroyRef.onDestroy(() => {
      this.markerReveal?.cancel();
      this.clusterOpening?.cancel();
      if (this.pendingViewUpdate !== undefined) {
        cancelAnimationFrame(this.pendingViewUpdate.frame);
      }
      const map = this.map();
      if (map !== undefined) {
        // Stopping a running animation fires `moveend`; the output is already gone then.
        map.off('moveend');
        destroyMap(map);
      }
    });
  }

  /** Centers the selected station again, e.g. when its row in the list is chosen once more. */
  revealSelectedStation(): void {
    const map = this.map();
    const selectedStationIdentifier = this.selectedStationIdentifier();
    const marker =
      selectedStationIdentifier === undefined
        ? undefined
        : this.stationMarkers.markerOf(selectedStationIdentifier);
    if (map !== undefined && marker !== undefined) {
      this.reveal(map, marker);
    }
  }

  /**
   * A price tag reached with the Tab key may lie under an overlay; it moves into the visible part
   * of the map like a revealed one, so the focus is never hidden.
   */
  protected bringFocusedMarkerIntoView(event: FocusEvent): void {
    const map = this.map();
    const target = event.target;
    if (
      map === undefined ||
      !(target instanceof HTMLElement) ||
      map.getPane('markerPane')?.contains(target) !== true
    ) {
      return;
    }
    const viewportPadding = this.viewportPadding();
    const markerPoint = L.DomUtil.getPosition(target);
    if (isInVisibleArea(map, map.layerPointToContainerPoint(markerPoint), viewportPadding)) {
      return;
    }
    const center = centerForVisibleArea(map, map.layerPointToLatLng(markerPoint), viewportPadding);
    this.moveProgrammatically(() => {
      map.panTo(center, this.motion());
    });
  }

  private selectFromMap(marker: StationMarker): void {
    // A selection does not change when its price tag is clicked again, so center it here.
    const map = this.map();
    if (map !== undefined && this.selectedStationIdentifier() === marker.stationIdentifier) {
      this.reveal(map, marker);
    }
    this.stationSelected.emit(marker.stationIdentifier);
  }

  /**
   * Overlays and the map size report their changes one by one, often in separate change
   * detection rounds. Applying them together once per frame moves the map once instead of
   * starting a new animation for every report.
   */
  private scheduleViewUpdate(map: L.Map, change: 'padding' | 'size'): void {
    const pendingViewUpdate = (this.pendingViewUpdate ??= {
      frame: requestAnimationFrame(() => {
        this.applyViewUpdate(map);
      }),
      hasPaddingChanged: false,
      hasSizeChanged: false,
    });
    if (change === 'padding') {
      pendingViewUpdate.hasPaddingChanged = true;
    } else {
      pendingViewUpdate.hasSizeChanged = true;
    }
  }

  private applyViewUpdate(map: L.Map): void {
    const update = this.pendingViewUpdate;
    this.pendingViewUpdate = undefined;
    if (update === undefined) {
      return;
    }
    let hasSizeChanged = false;
    if (update.hasSizeChanged) {
      const sizeBefore = map.getSize();
      map.invalidateSize();
      hasSizeChanged = !sizeBefore.equals(map.getSize());
    }
    const isCoveredByOverlays = !hasVisibleArea(map, this.viewportPadding());
    this.isCoveredByOverlays.set(isCoveredByOverlays);
    // Nothing to show behind overlays covering the whole map; the next change fits again.
    if ((!update.hasPaddingChanged && !hasSizeChanged) || isCoveredByOverlays) {
      return;
    }
    // The view set up before the overlays had their size was never meant to be seen; correct it
    // without an animation.
    const motion = this.hasAppliedViewUpdate ? this.motion() : { animate: false };
    this.hasAppliedViewUpdate = true;
    const selectedStationIdentifier = this.selectedStationIdentifier();
    const selectedMarker =
      selectedStationIdentifier === undefined
        ? undefined
        : this.stationMarkers.markerOf(selectedStationIdentifier);
    if (selectedMarker !== undefined) {
      // E.g. the sheet moved after a price tag was chosen: keep that station in the middle.
      if (!this.hasUserMovedMapSinceReveal) {
        this.reveal(map, selectedMarker, motion);
      }
      return;
    }
    if (!this.hasUserMovedMap) {
      this.fitSearchArea(map, motion);
    }
  }

  /** Animates map moves unless the user prefers reduced motion. */
  private motion(): L.ZoomPanOptions {
    return { animate: !this.prefersReducedMotion() };
  }

  private markUserMovement(): void {
    this.hasUserMovedMap = true;
    this.hasUserMovedMapSinceReveal = true;
  }

  private moveProgrammatically(move: () => void): void {
    this.isMovingProgrammatically = true;
    move();
  }

  /**
   * Fits the search radius into the part of the map not covered by overlays. Returns false
   * without moving while the overlays leave nothing visible: fitting into no space at all would
   * jump to the maximum zoom.
   */
  private fitSearchArea(map: L.Map, motion: L.ZoomPanOptions): boolean {
    const viewportPadding = this.viewportPadding();
    if (!hasVisibleArea(map, viewportPadding)) {
      return false;
    }
    this.moveProgrammatically(() => {
      map.fitBounds(searchAreaBounds(this.center(), this.radiusInKilometers()), {
        ...toPaddingOptions(viewportPadding),
        ...motion,
      });
    });
    return true;
  }

  private openCluster(map: L.Map, cluster: L.MarkerCluster, isFromKeyboard: boolean): void {
    this.clusterOpening?.cancel();
    // The user chose the view of the cluster; size and overlay changes keep it.
    this.markUserMovement();
    const clusterIcon = cluster.getElement();
    this.clusterOpening = this.stationMarkers.openCluster(
      map,
      cluster,
      this.viewportPadding(),
      this.motion(),
      () => {
        this.clusterOpening = undefined;
        if (isFromKeyboard) {
          this.focusOpenedCluster(cluster, clusterIcon);
        }
      }
    );
  }

  /**
   * Opening the cluster removes the focused cluster icon, which would drop the focus to the page.
   * Moves it to what shows the cluster's cheapest station, or to the map, unless the user focused
   * something else meanwhile.
   */
  private focusOpenedCluster(cluster: L.MarkerCluster, clusterIcon: HTMLElement | undefined): void {
    const focusedElement = document.activeElement;
    if (
      focusedElement !== null &&
      focusedElement !== document.body &&
      focusedElement !== clusterIcon
    ) {
      return;
    }
    const target =
      this.stationMarkers.elementShowingCheapestOf(cluster) ?? this.container().nativeElement;
    // Leaflet positions the panes itself; a scrolled map container would shift them.
    target.focus({ preventScroll: true });
  }

  /**
   * Opens the marker's cluster if needed, then centers the marker in the visible part of the map,
   * like a tapped pin in Apple Maps.
   */
  private reveal(map: L.Map, marker: StationMarker, motion = this.motion()): void {
    this.markerReveal?.cancel();
    this.hasUserMovedMapSinceReveal = false;
    this.markerReveal = this.stationMarkers.reveal(map, marker, () => {
      this.moveProgrammatically(() => {
        map.panTo(centerForVisibleArea(map, marker.getLatLng(), this.viewportPadding()), motion);
      });
    });
  }
}
