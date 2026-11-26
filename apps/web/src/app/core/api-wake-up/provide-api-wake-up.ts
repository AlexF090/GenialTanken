import { HttpClient } from '@angular/common/http';
import { inject, provideAppInitializer } from '@angular/core';
import type { EnvironmentProviders } from '@angular/core';
import { API_BASE_URL } from '../http/api-base-url';

/**
 * The free Render instance of the API sleeps without traffic and needs about a minute to start.
 * The app wakes it up right at the start, so it starts while the browser still asks for the
 * location. Fire and forget: rendering never waits, and a failure is ignored because the
 * stations request that follows reports problems itself.
 */
export const provideApiWakeUp = (): EnvironmentProviders =>
  provideAppInitializer(() => {
    inject(HttpClient)
      .get(`${inject(API_BASE_URL)}/wake-up`)
      .subscribe({ error: () => undefined });
  });
