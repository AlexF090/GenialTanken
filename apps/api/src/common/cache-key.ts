/** Every owner of entries in the shared cache, so keys of different owners never collide. */
export type CacheNamespace = 'upstream-json' | 'upstream-text' | 'france-missing-station-identity';

export const toCacheKey = (namespace: CacheNamespace, key: string): string => `${namespace}:${key}`;
