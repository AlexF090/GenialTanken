import { createEnvironmentInjector, EnvironmentInjector } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { COMPACT_MEDIA_QUERY } from './breakpoints';
import { MATCH_MEDIA } from './media-query';
import { Viewport } from './viewport';

const configure = (matchMedia: FakeMatchMedia | null): void => {
  TestBed.configureTestingModule({
    providers: [{ provide: MATCH_MEDIA, useValue: matchMedia?.matchMedia ?? null }],
  });
};

describe('Viewport', () => {
  it('uses the width breakpoint shared with the stylesheets', () => {
    expect(COMPACT_MEDIA_QUERY).toBe('(width < 48rem)');
  });

  it('reports a compact viewport when the compact query matches initially', () => {
    configure(new FakeMatchMedia([COMPACT_MEDIA_QUERY]));

    expect(TestBed.inject(Viewport).isCompactViewport()).toBe(true);
  });

  it('follows changes of the window size', () => {
    const matchMedia = new FakeMatchMedia();
    configure(matchMedia);
    const viewport = TestBed.inject(Viewport);

    expect(viewport.isCompactViewport()).toBe(false);

    matchMedia.setMatches(COMPACT_MEDIA_QUERY, true);
    expect(viewport.isCompactViewport()).toBe(true);

    matchMedia.setMatches(COMPACT_MEDIA_QUERY, false);
    expect(viewport.isCompactViewport()).toBe(false);
  });

  it('stops listening when its injector is destroyed', () => {
    const matchMedia = new FakeMatchMedia();
    configure(matchMedia);
    const injector = createEnvironmentInjector([Viewport], TestBed.inject(EnvironmentInjector));
    injector.get(Viewport);

    expect(matchMedia.listenerCount(COMPACT_MEDIA_QUERY)).toBe(1);

    injector.destroy();

    expect(matchMedia.listenerCount(COMPACT_MEDIA_QUERY)).toBe(0);
  });

  it('treats the viewport as not compact where matchMedia is unavailable', () => {
    configure(null);

    expect(TestBed.inject(Viewport).isCompactViewport()).toBe(false);
  });
});
