import { registerLocaleData } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import localeGerman from '@angular/common/locales/de';
import { LOCALE_ID, provideBrowserGlobalErrorListeners } from '@angular/core';
import type { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';
import { routes } from './app.routes';
import { provideLocalStorageFavorites } from './core/favorites/local-storage-favorites-repository';

registerLocaleData(localeGerman);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withInMemoryScrolling({ scrollPositionRestoration: 'enabled' })
    ),
    provideHttpClient(),
    provideLocalStorageFavorites(),
    { provide: LOCALE_ID, useValue: 'de' },
  ],
};
