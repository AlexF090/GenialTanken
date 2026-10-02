import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { Icon } from '../icon/icon';
import type { IconName } from '../icon/icon';

interface NavigationLink {
  path: string;
  label: string;
  icon: IconName;
  /** The explore page must only be active on `/`, not on every route below it. */
  matchesExactly: boolean;
}

const NAVIGATION_LINKS: readonly NavigationLink[] = [
  { path: '/', label: 'Erkunden', icon: 'explore', matchesExactly: true },
  { path: '/favorites', label: 'Favoriten', icon: 'star', matchesExactly: false },
  { path: '/settings', label: 'Einstellungen', icon: 'settings', matchesExactly: false },
];

@Component({
  selector: 'app-navigation-bar',
  imports: [RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './navigation-bar.html',
  styleUrl: './navigation-bar.scss',
})
export class NavigationBar {
  protected readonly links = NAVIGATION_LINKS;
}
