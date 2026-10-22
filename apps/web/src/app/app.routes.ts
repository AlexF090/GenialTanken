import type { Routes } from '@angular/router';
import { APPLICATION_NAME } from './core/application-name';
import { STATION_ROUTE_PATH } from './core/navigation/station-route';

export const routes: Routes = [
  {
    path: 'favorites',
    title: `Favoriten – ${APPLICATION_NAME}`,
    loadComponent: () =>
      import('./pages/favorites-page/favorites-page').then(module => module.FavoritesPage),
  },
  {
    path: 'settings',
    title: `Einstellungen – ${APPLICATION_NAME}`,
    loadComponent: () =>
      import('./pages/settings-page/settings-page').then(module => module.SettingsPage),
  },
  // The map used to be a page of its own; it is part of the start page now.
  { path: 'map', redirectTo: '' },
  // Start page with map and list. A station opens as a card in its sheet (or side panel), like a
  // place in Apple Maps, so map and search stay where they were; the URL still names the station.
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
    ],
  },
  {
    path: '**',
    title: `Seite nicht gefunden – ${APPLICATION_NAME}`,
    loadComponent: () =>
      import('./pages/not-found-page/not-found-page').then(module => module.NotFoundPage),
  },
];
