import { DestroyRef, inject, InjectionToken, signal } from '@angular/core';
import type { Signal } from '@angular/core';
import { MILLISECONDS_PER_MINUTE } from '@genialtanken/contracts';

/** The current date and time, advancing every minute, e.g. to mark today in opening times. */
export const CURRENT_DATE = new InjectionToken<Signal<Date>>('CurrentDate', {
  providedIn: 'root',
  factory: () => {
    const currentDate = signal(new Date());
    const interval = setInterval(() => {
      currentDate.set(new Date());
    }, MILLISECONDS_PER_MINUTE);
    inject(DestroyRef).onDestroy(() => {
      clearInterval(interval);
    });
    return currentDate.asReadonly();
  },
});
