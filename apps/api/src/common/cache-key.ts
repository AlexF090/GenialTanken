/**
 * Key in the shared cache. Each owner passes its own namespace, so keys of different owners never
 * collide.
 */
export const toCacheKey = (namespace: string, key: string): string => `${namespace}:${key}`;
