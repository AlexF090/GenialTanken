import { computed, effect, inject, signal, untracked } from '@angular/core';
import type { Resource, Signal } from '@angular/core';
import { CURRENT_DATE } from './current-date';

/**
 * When the resource received its current value, by the `CURRENT_DATE` clock; `undefined` while it
 * has none. An effect records it, because a computed would read the clock only when first read.
 * Must be called in an injection context.
 */
export const injectLoadedAt = (resource: Resource<unknown>): Signal<Date | undefined> => {
  const currentDate = inject(CURRENT_DATE);
  const loadedAt = signal<Date | undefined>(undefined);
  effect(() => {
    if (!resource.hasValue()) {
      return;
    }
    resource.value();
    loadedAt.set(untracked(currentDate));
  });
  return computed(() => (resource.hasValue() ? loadedAt() : undefined));
};
