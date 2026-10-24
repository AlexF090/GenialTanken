import { effect, signal } from '@angular/core';
import type { Signal } from '@angular/core';

/**
 * True once `isActive` has stayed true for `delayInMilliseconds`, until it turns false. Call it
 * in an injection context.
 */
export function injectHasLastedFor(
  isActive: Signal<boolean>,
  delayInMilliseconds: number
): Signal<boolean> {
  const hasLasted = signal(false);
  effect(onCleanup => {
    if (!isActive()) {
      hasLasted.set(false);
      return;
    }
    const timer = setTimeout(() => {
      hasLasted.set(true);
    }, delayInMilliseconds);
    onCleanup(() => {
      clearTimeout(timer);
    });
  });
  return hasLasted.asReadonly();
}
