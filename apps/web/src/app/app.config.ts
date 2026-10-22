import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import localeGerman from '@angular/common/locales/de';
import {
  inject,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { routes } from './app.routes';
import { bypassServiceWorkerForApi } from './core/http/bypass-service-worker';
import { provideLocalStorageFavorites } from './core/favorites/local-storage-favorites-repository';
import { InstallationHint } from './core/installation/installation-hint';
import { ColorSchemeController } from './core/theme/color-scheme-controller';

registerLocaleData(localeGerman);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),
    provideHttpClient(withInterceptors([bypassServiceWorkerForApi])),
    // Registered once the app is idle (at the latest after 30 s), so it never competes with the
    // first stations request. `ng serve` builds without a service worker.
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
    provideLocalStorageFavorites(),
    { provide: LOCALE_ID, useValue: 'de' },
    provideAppInitializer(() => {
      inject(ColorSchemeController);
      // Listens for the browser's install dialog from the start; it is announced only once.
      inject(InstallationHint);
    }),
  ],
};
