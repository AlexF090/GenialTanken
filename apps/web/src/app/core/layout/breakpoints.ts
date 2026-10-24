// Window size classes, mirrored in `src/styles/breakpoints.scss`. Keep both in sync.

const MEDIUM_MINIMUM_WIDTH_IN_REM = 48;

/** Phones: the list is a bottom sheet over the full-screen map. */
export const COMPACT_MEDIA_QUERY = `(width < ${String(MEDIUM_MINIMUM_WIDTH_IN_REM)}rem)`;
