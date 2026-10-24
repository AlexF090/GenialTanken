import { TestBed } from '@angular/core/testing';
import wordmarkSource from '../../../../icon-source/wordmark.svg' with { loader: 'text' };
import { hostElementOf } from '../../../testing/render-page';
import { Wordmark } from './wordmark';

interface DrawnPath {
  transform: string | null;
  pathData: string | null;
}

const drawnPathsOf = (svg: Element | null | undefined): DrawnPath[] =>
  [...(svg?.querySelectorAll('path') ?? [])].map(path => ({
    transform: path.getAttribute('transform'),
    pathData: path.getAttribute('d'),
  }));

const render = async (): Promise<HTMLElement> => {
  const fixture = TestBed.createComponent(Wordmark);
  await fixture.whenStable();
  return hostElementOf(fixture);
};

describe('Wordmark', () => {
  it('is one image named after the app, so screen readers read the name once', async () => {
    const element = await render();

    const images = element.querySelectorAll('[role="img"]');

    expect(images).toHaveLength(1);
    expect(images[0]?.getAttribute('aria-label')).toBe('GenialTanken');
  });

  it('draws the glyphs of the brand asset in `icon-source/wordmark.svg`', async () => {
    const element = await render();
    const source = new DOMParser().parseFromString(wordmarkSource, 'image/svg+xml');

    const sourcePaths = drawnPathsOf(source.documentElement);
    expect(sourcePaths).toHaveLength(13);
    expect(drawnPathsOf(element.querySelector('svg'))).toEqual(sourcePaths);
  });
});
