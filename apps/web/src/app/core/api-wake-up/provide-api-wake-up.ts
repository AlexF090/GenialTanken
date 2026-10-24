import { HttpClient } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';

export const API_WAKE_UP_URL = '/api/wake-up';

/**
 * The free Render instance of the API sleeps without traffic and needs about a minute to start.
 * The app wakes it up right at the start, so it starts while the browser still asks for the
 * location. Fire and forget: rendering never waits, and a failure is ignored because the
 * stations request that follows reports problems itself.
 */
export const provideApiWakeUp = (): EnvironmentProviders =>
  provideAppInitializer(() => {
    inject(HttpClient)
      .get(API_WAKE_UP_URL)
      .subscribe({ error: () => undefined });
  });
