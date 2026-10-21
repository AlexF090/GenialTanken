import * as z from 'zod';

export const COLOR_SCHEME_PREFERENCES = ['system', 'light', 'dark'] as const;

export const colorSchemePreferenceSchema = z.enum(COLOR_SCHEME_PREFERENCES);

export type ColorSchemePreference = z.infer<typeof colorSchemePreferenceSchema>;

export const DEFAULT_COLOR_SCHEME_PREFERENCE: ColorSchemePreference = 'system';
