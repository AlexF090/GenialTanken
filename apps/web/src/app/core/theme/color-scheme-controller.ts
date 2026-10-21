import { computed, DOCUMENT, effect, inject, Injectable } from '@angular/core';
import { injectMediaQueryMatches } from '../layout/media-query';
import { SettingsStore } from '../settings/settings-store';

export type ResolvedColorScheme = 'light' | 'dark';

export const PREFERS_DARK_COLOR_SCHEME_MEDIA_QUERY = '(prefers-color-scheme: dark)';

/** `media` of the theme color meta element that is applied, and of those that are not. */
const APPLIED_MEDIA = 'all';
const NOT_APPLIED_MEDIA = 'not all';

/**
 * Applies the color scheme preference: resolves "system" against the operating system, sets
 * `data-color-scheme` on <html> (which `tokens.scss` reads) and tints the browser UI. The inline
 * script in `index.html` does the same before bootstrap to avoid a flash of the wrong scheme.
 *
 * The browser UI colors live only in the `theme-color` meta elements of `index.html` (one per
 * scheme, marked with `data-scheme`), next to `--color-chrome` in `tokens.scss`: the inline
 * script runs before any stylesheet has loaded, so it cannot read the token. Instead of copying
 * the colors, the matching meta element is switched on through its `media` attribute.
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
    // Their original `media` only reflects the operating system, which a preference overrides.
    for (const themeColor of this.document.querySelectorAll<HTMLMetaElement>(
      'meta[name="theme-color"][data-scheme]'
    )) {
      themeColor.media =
        themeColor.dataset['scheme'] === scheme ? APPLIED_MEDIA : NOT_APPLIED_MEDIA;
    }
  }
}
