import type { ViewportPadding } from '../../ui/map/map-viewport';

/** What covers the map of the explore page, measured in pixels from the window edges. */
export interface ExploreOverlays {
  isCompactViewport: boolean;
  /**
   * Bottom edge of the map controls (locate button, zoom buttons on phones, area search,
   * notices): the status bar and the controls above it are covered.
   */
  mapControlsBottom: number;
  /** Height of the settled bottom sheet over the bottom of the map (phones). */
  sheetHeight: number;
  /** Right edge of the floating side panel (from 48rem), which covers the map left of it. */
  panelRight: number;
}

/**
 * The part of the map that overlays leave visible, so a chosen station is centered there: below
 * the map controls, above the sheet on phones and right of the side panel on larger windows.
 */
export const mapViewportPaddingFor = (overlays: ExploreOverlays): ViewportPadding => ({
  top: Math.max(overlays.mapControlsBottom, 0),
  right: 0,
  bottom: overlays.isCompactViewport ? overlays.sheetHeight : 0,
  left: overlays.isCompactViewport ? 0 : Math.max(overlays.panelRight, 0),
});
