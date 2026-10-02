import { computed, DOCUMENT, effect, inject, Injectable } from '@angular/core';
import { injectMediaQueryMatches } from '../layout/media-query';
import { SettingsStore } from '../settings/settings-store';

export type ResolvedColorScheme = 'light' | 'dark';

export const PREFERS_DARK_COLOR_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/**
 * Browser UI color per scheme, matching `--color-chrome` in `src/styles/tokens.scss` and the
 * `theme-color` meta elements in `index.html`. Keep all three in sync.
 */
export const THEME_COLORS: Readonly<Record<ResolvedColorScheme, string>> = {
  light: '#0e3b4a',
  dark: '#06171d',
};

/**
 * Applies the color scheme preference: resolves "system" against the operating system, sets
 * `data-color-scheme` on <html> (which `tokens.scss` reads) and tints the browser UI. The inline
 * script in `index.html` does the same before bootstrap to avoid a flash of the wrong scheme.
 */
@Injectable({ providedIn: 'root' })
export class ColorSchemeController {
  private readonly document = inject(DOCUMENT);
  private readonly settingsStore = inject(SettingsStore);
  private readonly prefersDarkColorScheme = injectMediaQueryMatches(
    PREFERS_DARK_COLOR_SCHEME_MEDIA_QUERY
  );

  readonly resolvedScheme = computed<ResolvedColorScheme>(() => {
    const preference = this.settingsStore.colorScheme();
    if (preference !== 'system') {
      return preference;
    }
    return this.prefersDarkColorScheme() ? 'dark' : 'light';
  });

  constructor() {
    effect(() => {
      this.apply(this.resolvedScheme());
    });
  }

  private apply(scheme: ResolvedColorScheme): void {
    this.document.documentElement.setAttribute('data-color-scheme', scheme);
    // Both meta elements get the resolved color: their `media` only reflects the operating
    // system, which an explicit preference overrides.
    for (const themeColor of this.document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"]'
    )) {
      themeColor.content = THEME_COLORS[scheme];
    }
  }
}
