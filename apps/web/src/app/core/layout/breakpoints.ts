// Window size classes, mirrored in `src/styles/breakpoints.scss`. Keep both in sync.

const MEDIUM_MINIMUM_WIDTH_IN_REM = 48;

/** Phones: bottom navigation, list and map as separate views. */
export const COMPACT_MEDIA_QUERY = `(width < ${String(MEDIUM_MINIMUM_WIDTH_IN_REM)}rem)`;
