import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavigationBar } from './ui/navigation-bar/navigation-bar';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavigationBar],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-navigation-bar />
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      min-height: 100dvh;
    }
  `,
})
export class App {}
