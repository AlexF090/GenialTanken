import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { provideApiWakeUp } from './core/api-wake-up/provide-api-wake-up';
import { bypassServiceWorkerForApi } from './core/http/bypass-service-worker';
import { provideLocalStorageFavorites } from './core/favorites/local-storage-favorites-repository';
import { InstallationHint } from './core/installation/installation-hint';
import { ColorSchemeController } from './core/theme/color-scheme-controller';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),
    provideHttpClient(withInterceptors([bypassServiceWorkerForApi])),
    provideApiWakeUp(),
    // Registered once the app is idle (at the latest after 30 s), so it never competes with the
    // first stations request. `ng serve` builds without a service worker.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideLocalStorageFavorites(),
    provideAppInitializer(() => {
      inject(ColorSchemeController);
      // Listens for the browser's install dialog from the start; it is announced only once.
      inject(InstallationHint);
    }),
  ],
};
