// Pure gesture decisions of the bottom sheet, kept free of the DOM so they are testable on their own.

import type { SnapPosition } from './bottom-sheet-snap';

export type ContentGestureDecision = 'undecided' | 'claim' | 'release';

/** The list counts as being at its top below this scroll offset (fractional scroll positions). */
const TOP_TOLERANCE_IN_PIXELS = 1;

/**
 * After a wheel step, further wheel events of the same direction (trackpad momentum) are
 * swallowed as long as each arrives within this time of the one before.
 */
export const WHEEL_LOCK_GAP_IN_MILLISECONDS = 120;

/** Smaller wheel movements are sensor noise and move nothing. */
const MINIMUM_WHEEL_PIXELS = 5;

/** The wheel events that follow a step: when the last one came and which way they scroll. */
export interface WheelLock {
  timeStamp: number;
  direction: 1 | -1;
}

const PIXELS_PER_LINE = 16;
const PIXELS_PER_PAGE = 800;

/**
 * Whether a touch that started on the content moves the sheet. Below full the list never
 * scrolls, so every vertical swipe belongs to the sheet; at full only a downward swipe that
 * starts at the top of the list does. Horizontal swipes and swipes the list scrolls are released.
 */
export const contentGestureDecision = ({
  position,
  startScrollTop,
  dx,
  dy,
  threshold,
}: {
  position: SnapPosition;
  startScrollTop: number;
  dx: number;
  dy: number;
  threshold: number;
}): ContentGestureDecision => {
  if (Math.max(Math.abs(dx), Math.abs(dy)) < threshold) {
    return 'undecided';
  }
  if (Math.abs(dx) > Math.abs(dy)) {
    return 'release';
  }
  if (position !== 'full') {
    return 'claim';
  }
  return startScrollTop < TOP_TOLERANCE_IN_PIXELS && dy > 0 ? 'claim' : 'release';
};

const pixelsOf = (delta: number, deltaMode: number): number => {
  if (deltaMode === 1) {
    return delta * PIXELS_PER_LINE;
  }
  return deltaMode === 2 ? delta * PIXELS_PER_PAGE : delta;
};

/**
 * Where a mouse wheel or trackpad scroll over the content moves the sheet: down below full
 * opens it, up at full from the top of the list lowers it to half. `swallow` tells whether the
 * event must not scroll the list, which includes the trailing events after a step. `lock` is
 * what the caller passes back with the next event.
 */
export const wheelTarget = ({
  position,
  scrollTop,
  deltaY,
  deltaMode,
  ctrlKey,
  timeStamp,
  lock,
}: {
  position: SnapPosition;
  scrollTop: number;
  deltaY: number;
  deltaMode: number;
  ctrlKey: boolean;
  timeStamp: number;
  lock: WheelLock | undefined;
}): { target: SnapPosition | null; swallow: boolean; lock: WheelLock | undefined } => {
  const pixels = pixelsOf(deltaY, deltaMode);
  if (ctrlKey || pixels === 0) {
    return { target: null, swallow: false, lock };
  }
  const direction = pixels > 0 ? 1 : -1;
  if (
    lock?.direction === direction &&
    timeStamp - lock.timeStamp < WHEEL_LOCK_GAP_IN_MILLISECONDS
  ) {
    return { target: null, swallow: true, lock: { timeStamp, direction } };
  }
  if (Math.abs(pixels) < MINIMUM_WHEEL_PIXELS) {
    return { target: null, swallow: false, lock: undefined };
  }
  const next = { timeStamp, direction } as const;
  if (position !== 'full') {
    return pixels > 0
      ? { target: 'full', swallow: true, lock: next }
      : { target: null, swallow: true, lock: next };
  }
  if (pixels < 0 && scrollTop < TOP_TOLERANCE_IN_PIXELS) {
    return { target: 'half', swallow: true, lock: next };
  }
  return { target: null, swallow: false, lock: undefined };
};
