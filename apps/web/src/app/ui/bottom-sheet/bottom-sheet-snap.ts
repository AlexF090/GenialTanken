// Pure snap logic of the bottom sheet, kept free of the DOM so it is testable on its own.

export type SnapPosition = 'peek' | 'half' | 'full';
export type SnapDirection = 'up' | 'down';

/** Smallest to largest; ties resolve to the earlier position. */
export const SNAP_POSITIONS: readonly SnapPosition[] = ['peek', 'half', 'full'];

/** How far ahead a release is projected along its velocity, like a flick that keeps gliding. */
const VELOCITY_PROJECTION_IN_MILLISECONDS = 200;

/** Visible height in pixels per snap position. */
export type SnapHeights = Record<SnapPosition, number>;

/** Half opens the sheet to this share of the window: room for two or three stations. */
const HALF_SHARE_OF_WINDOW = 0.55;

/** Half shows at least about two rows of the station list more than peek. */
const MINIMUM_HALF_ABOVE_PEEK_IN_PIXELS = 136;

/**
 * Peek shows the handle and header, half 55 % of the window like the middle detent of Apple
 * Maps, full all of the sheet. On low windows (landscape phones) half rises to two rows above
 * peek, so it never lands just above peek; where even that does not fit, half meets full. Small
 * sheets collapse the positions instead of inverting their order.
 */
export const snapHeights = ({
  sheetHeight,
  peekHeight,
  windowHeight,
}: {
  sheetHeight: number;
  peekHeight: number;
  windowHeight: number;
}): SnapHeights => {
  const peek = Math.min(peekHeight, sheetHeight);
  const half = Math.min(
    Math.max(
      Math.round(windowHeight * HALF_SHARE_OF_WINDOW),
      peek + MINIMUM_HALF_ABOVE_PEEK_IN_PIXELS
    ),
    sheetHeight
  );
  return { peek, half, full: sheetHeight };
};

/**
 * Snap position for a released drag. `velocity` is in pixels per millisecond, positive while
 * the sheet grows, so a quick flick carries on to the next position.
 */
export const nearestSnapPosition = ({
  visibleHeight,
  velocity,
  heights,
}: {
  visibleHeight: number;
  velocity: number;
  heights: SnapHeights;
}): SnapPosition => {
  const projectedHeight = visibleHeight + velocity * VELOCITY_PROJECTION_IN_MILLISECONDS;
  let nearest: SnapPosition = 'peek';
  for (const position of SNAP_POSITIONS) {
    if (
      Math.abs(heights[position] - projectedHeight) < Math.abs(heights[nearest] - projectedHeight)
    ) {
      nearest = position;
    }
  }
  return nearest;
};

/** One position up or down, staying put at either end (keyboard arrows). */
export const steppedSnapPosition = (
  position: SnapPosition,
  direction: SnapDirection
): SnapPosition => {
  const index = SNAP_POSITIONS.indexOf(position) + (direction === 'up' ? 1 : -1);
  const clampedIndex = Math.min(Math.max(index, 0), SNAP_POSITIONS.length - 1);
  return SNAP_POSITIONS[clampedIndex] ?? position;
};

/**
 * Activating the handle moves on in the current direction and turns around at either end:
 * peek → half → full → half → peek → …
 */
export const nextSnapPositionOnActivation = (
  position: SnapPosition,
  direction: SnapDirection
): { position: SnapPosition; direction: SnapDirection } => {
  if (position === 'full') {
    return { position: 'half', direction: 'down' };
  }
  if (position === 'peek') {
    return { position: 'half', direction: 'up' };
  }
  return { position: steppedSnapPosition(position, direction), direction };
};
