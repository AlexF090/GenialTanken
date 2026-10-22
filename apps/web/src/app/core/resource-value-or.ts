import type { Resource } from '@angular/core';

/** The resource's value once it has one; the fallback while it loads or after it failed. */
export const resourceValueOr = <Value, Fallback>(
  resource: Resource<Value | undefined>,
  fallback: Fallback
): Value | Fallback => {
  // `value()` throws while the resource is in its error state.
  if (!resource.hasValue()) {
    return fallback;
  }
  return resource.value();
};
