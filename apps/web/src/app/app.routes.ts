import type { Routes } from '@angular/router';
import { APPLICATION_NAME } from './core/application-name';
import { FAVORITES_ROUTE_PATH, SETTINGS_ROUTE_PATH } from './core/navigation/explore-routes';
import { STATION_ROUTE_PATH } from './core/navigation/station-route';

export const routes: Routes = [
  // The map used to be a page of its own; it is part of the start page now.
  { path: 'map', redirectTo: '' },
  // Start page with map and list. A station and the favorites open as a card in its sheet (or
  // side panel), like a place in Apple Maps, and the settings as a dialog over it, so map and
  // search stay where they were; the URL still names what is open.
  {
    path: '',
    loadComponent: () =>
      import('./pages/explore-page/explore-page').then(module => module.ExplorePage),
    children: [
      { path: '', pathMatch: 'full', title: APPLICATION_NAME, children: [] },
      {
        path: STATION_ROUTE_PATH,
        title: `Details – ${APPLICATION_NAME}`,
        loadComponent: () =>
          import('./pages/station-detail-page/station-detail-page').then(
            module => module.StationDetailPage
          ),
      },
      {
        path: FAVORITES_ROUTE_PATH,
        title: `Favoriten – ${APPLICATION_NAME}`,
        loadComponent: () =>
          import('./pages/favorites-page/favorites-page').then(module => module.FavoritesPage),
      },
      {
        path: SETTINGS_ROUTE_PATH,
        title: `Einstellungen – ${APPLICATION_NAME}`,
        loadComponent: () =>
          import('./pages/settings-page/settings-page').then(module => module.SettingsPage),
      },
    ],
  },
  {
    path: '**',
    title: `Seite nicht gefunden – ${APPLICATION_NAME}`,
    loadComponent: () =>
      import('./pages/not-found-page/not-found-page').then(module => module.NotFoundPage),
  },
];
