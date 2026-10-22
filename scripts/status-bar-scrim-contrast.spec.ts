import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const tokens = readFileSync(new URL('../apps/web/src/styles/tokens.scss', import.meta.url), 'utf8');

/** All values of a custom property in tokens.scss, in file order. */
const declarationsOf = (property: string): string[] =>
  [...tokens.matchAll(new RegExp(`${property}:\\s*([^;]+);`, 'g'))].map(match => match[1] ?? '');

const blackOpacityOf = (value: string): number => {
  const match = /^rgb\(0 0 0(?: \/ (\d+)%)?\)$/.exec(value.trim());
  if (match === null) {
    throw new Error(`Expected a black rgb() value, got "${value}"`);
  }
  return match[1] === undefined ? 1 : Number(match[1]) / 100;
};

const relativeLuminanceOfGray = (channel: number): number =>
  channel <= 0.040_45 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;

/** Contrast of white text over black of the given opacity on a white map tile (WCAG 2.2). */
const contrastOfWhiteTextOnWhiteTile = (blackOpacity: number): number =>
  1.05 / (relativeLuminanceOfGray(1 - blackOpacity) + 0.05);

describe('--color-status-bar-scrim in apps/web/src/styles/tokens.scss', () => {
  const [regular, moreContrast] = declarationsOf('--color-status-bar-scrim');

  it('keeps the white status bar text at 4.5:1 or more over white map tiles', () => {
    expect(contrastOfWhiteTextOnWhiteTile(blackOpacityOf(regular ?? ''))).toBeGreaterThanOrEqual(
      4.5
    );
  });

  it('is opaque with more contrast', () => {
    expect(blackOpacityOf(moreContrast ?? '')).toBe(1);
  });

  it('fades out towards the map', () => {
    const [regularEnd, moreContrastEnd] = declarationsOf('--color-status-bar-scrim-end');
    expect(blackOpacityOf(regularEnd ?? '')).toBe(0);
    expect(blackOpacityOf(moreContrastEnd ?? '')).toBe(1);
  });
});
