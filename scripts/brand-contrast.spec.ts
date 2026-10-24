import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('../apps/web/src/styles/tokens.scss', import.meta.url), 'utf8');

type ColorScheme = 'light' | 'dark';

const COLOR_SCHEMES: readonly ColorScheme[] = ['light', 'dark'];

/** The first value of a custom property in tokens.scss; later ones are media query overrides. */
const declarationOf = (property: string): string => {
  const match = new RegExp(`${property}:\\s*([^;]+);`).exec(tokens);
  if (match?.[1] === undefined) {
    throw new Error(`Expected ${property} in tokens.scss`);
  }
  return match[1].trim();
};

/** Splits at the commas outside of parentheses. */
const splitArguments = (value: string): string[] => {
  const parts: string[] = [];
  let depth = 0;
  let current = '';
  for (const character of value) {
    if (character === '(') depth += 1;
    if (character === ')') depth -= 1;
    if (character === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current.trim());
  return parts;
};

const argumentsOf = (value: string, functionName: string): string[] | undefined => {
  const prefix = `${functionName}(`;
  if (!value.startsWith(prefix) || !value.endsWith(')')) {
    return undefined;
  }
  return splitArguments(value.slice(prefix.length, -1));
};

/** Resolves plain hex colors, `light-dark()` and `var()` of other tokens to a hex color. */
const resolveColor = (value: string, scheme: ColorScheme): string => {
  const trimmed = value.trim();
  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed;
  }
  const schemeValues = argumentsOf(trimmed, 'light-dark');
  if (schemeValues !== undefined) {
    const [light, dark] = schemeValues;
    return resolveColor((scheme === 'light' ? light : dark) ?? '', scheme);
  }
  const reference = argumentsOf(trimmed, 'var');
  if (reference?.[0] !== undefined) {
    return resolveColor(declarationOf(reference[0]), scheme);
  }
  throw new Error(`Cannot resolve the color "${trimmed}"`);
};

const colorOf = (property: string, scheme: ColorScheme): string =>
  resolveColor(declarationOf(property), scheme);

const gradientStopsOf = (property: string, scheme: ColorScheme): string[] => {
  const stops = argumentsOf(declarationOf(property), 'linear-gradient');
  if (stops === undefined) {
    throw new Error(`Expected ${property} to be a linear-gradient()`);
  }
  return stops.map(stop => resolveColor(stop, scheme));
};

const linearChannel = (channel: number): number =>
  channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

const relativeLuminanceOf = (hex: string): number => {
  const [red, green, blue] = [1, 3, 5].map(start =>
    linearChannel(Number.parseInt(hex.slice(start, start + 2), 16) / 255)
  );
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
};

/** WCAG 2.2 contrast ratio of two hex colors. */
const contrastOf = (first: string, second: string): number => {
  const [lighter, darker] = [relativeLuminanceOf(first), relativeLuminanceOf(second)].sort(
    (left, right) => right - left
  );
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
};

describe.each(COLOR_SCHEMES)('brand tokens in tokens.scss (%s)', scheme => {
  const color = (property: string): string => colorOf(property, scheme);

  it('keeps text on filled controls at 7:1 or more', () => {
    expect(contrastOf(color('--color-on-action'), color('--color-action'))).toBeGreaterThanOrEqual(
      7
    );
  });

  it.each(['--gradient-action', '--gradient-action-hover', '--gradient-action-pressed'])(
    'keeps text on both stops of %s at 7:1 or more',
    gradient => {
      for (const stop of gradientStopsOf(gradient, scheme)) {
        expect(contrastOf(color('--color-on-action'), stop)).toBeGreaterThanOrEqual(7);
      }
    }
  );

  it.each(['--color-surface', '--color-canvas'])(
    'keeps links at 7:1 or more against %s',
    background => {
      expect(contrastOf(color('--color-action-text'), color(background))).toBeGreaterThanOrEqual(7);
    }
  );

  it('keeps the focus ring at 3:1 or more against the surface', () => {
    expect(
      contrastOf(color('--color-focus-ring'), color('--color-surface'))
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps icons in the tint at 3:1 or more against the surface', () => {
    expect(
      contrastOf(color('--color-tint-vivid'), color('--color-surface'))
    ).toBeGreaterThanOrEqual(3);
  });

  it('keeps icons on the tint at 3:1 or more', () => {
    expect(
      contrastOf(color('--color-on-tint-vivid'), color('--color-tint-vivid'))
    ).toBeGreaterThanOrEqual(3);
  });
});
