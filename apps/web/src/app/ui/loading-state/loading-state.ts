import { ChangeDetectionStrategy, Component, effect, input, signal } from '@angular/core';

/** The free API host sleeps when idle; its first answer can take about a minute. */
export const COLD_START_HINT_DELAY_IN_MILLISECONDS = 4000;

@Component({
  selector: 'app-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-state.html',
  styleUrl: './loading-state.scss',
})
export class LoadingState {
  readonly isLoading = input.required<boolean>();
  readonly label = input('Tankstellen werden geladen …');

  protected readonly showsColdStartHint = signal(false);

  constructor() {
    effect(onCleanup => {
      if (!this.isLoading()) {
        this.showsColdStartHint.set(false);
        return;
      }
      const timer = setTimeout(() => {
        this.showsColdStartHint.set(true);
      }, COLD_START_HINT_DELAY_IN_MILLISECONDS);
      onCleanup(() => {
        clearTimeout(timer);
      });
    });
  }
}
