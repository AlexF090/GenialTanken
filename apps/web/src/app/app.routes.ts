import type { Routes } from '@angular/router';
import { StationsPage } from './pages/stations-page/stations-page';

const APPLICATION_NAME = 'GenialTanken';

export const routes: Routes = [
  { path: '', pathMatch: 'full', title: APPLICATION_NAME, component: StationsPage },
  {
    path: 'map',
    title: `Karte – ${APPLICATION_NAME}`,
    loadComponent: () => import('./pages/map-page/map-page').then(module => module.MapPage),
  },
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
  {
    path: 'stations/:id',
    title: `Details – ${APPLICATION_NAME}`,
    loadComponent: () =>
      import('./pages/station-detail-page/station-detail-page').then(
        module => module.StationDetailPage
      ),
  },
  {
    path: '**',
    title: `Seite nicht gefunden – ${APPLICATION_NAME}`,
    loadComponent: () =>
      import('./pages/not-found-page/not-found-page').then(module => module.NotFoundPage),
  },
];
