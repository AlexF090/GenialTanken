import {
  afterNextRender,
  assertInInjectionContext,
  effect,
  inject,
  Injector,
  untracked,
} from '@angular/core';
import type { Signal } from '@angular/core';

export interface SettingsLinkFocusOptions {
  isSettingsOpen: Signal<boolean>;
  isCardOpen: Signal<boolean>;
  settingsLink: () => HTMLElement | undefined;
}

/**
 * The dialog returns the focus to what opened it, but not when it was the first thing shown
 * (deep link) or the browser's back button closed it. The settings link is where it opens again.
 * Call it in an injection context.
 */
export const focusSettingsLinkAfterSettings = (options: SettingsLinkFocusOptions): void => {
  assertInInjectionContext(focusSettingsLinkAfterSettings);
  const injector = inject(Injector);
  let wasSettingsOpen = false;
  effect(() => {
    const isSettingsOpen = options.isSettingsOpen();
    const hasClosed = wasSettingsOpen && !isSettingsOpen;
    wasSettingsOpen = isSettingsOpen;
    if (!hasClosed || untracked(options.isCardOpen)) {
      return;
    }
    afterNextRender(
      () => {
        options.settingsLink()?.focus({ preventScroll: true });
      },
      { injector }
    );
  });
};
