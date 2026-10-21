// Window size classes, mirrored in `src/styles/breakpoints.scss`. Keep both in sync.

export const MEDIUM_MINIMUM_WIDTH_IN_REM = 48;
export const EXPANDED_MINIMUM_WIDTH_IN_REM = 64;

/** Phones: bottom navigation, list and map as separate views. */
export const COMPACT_MEDIA_QUERY = `(width < ${String(MEDIUM_MINIMUM_WIDTH_IN_REM)}rem)`;
/** Small tablets: navigation rail. */
export const MEDIUM_MEDIA_QUERY = `(${String(MEDIUM_MINIMUM_WIDTH_IN_REM)}rem <= width < ${String(EXPANDED_MINIMUM_WIDTH_IN_REM)}rem)`;
/** Large windows: list and map side by side. */
export const EXPANDED_MEDIA_QUERY = `(width >= ${String(EXPANDED_MINIMUM_WIDTH_IN_REM)}rem)`;
