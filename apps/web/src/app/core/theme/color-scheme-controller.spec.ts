import { DOCUMENT } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { FakeStorage } from '../../../testing/fake-storage';
import { BROWSER_STORAGE } from '../browser-storage';
import { MATCH_MEDIA } from '../layout/media-query';
import { SettingsStore } from '../settings/settings-store';
import {
  ColorSchemeController,
  PREFERS_DARK_COLOR_SCHEME_MEDIA_QUERY,
} from './color-scheme-controller';

const storedColorScheme = (colorScheme: string): FakeStorage =>
  new FakeStorage({
    'genialtanken.settings': JSON.stringify({
      fuelType: 'e5',
      radiusInKilometers: 5,
      colorScheme,
    }),
  });

describe('ColorSchemeController', () => {
  let matchMedia: FakeMatchMedia;
  let themeColors: HTMLMetaElement[];

  const startController = (storage: FakeStorage = new FakeStorage()): ColorSchemeController => {
    TestBed.configureTestingModule({
      providers: [
        { provide: BROWSER_STORAGE, useValue: storage },
        { provide: MATCH_MEDIA, useValue: matchMedia.matchMedia },
      ],
    });
    const controller = TestBed.inject(ColorSchemeController);
    TestBed.tick();
    return controller;
  };

  const documentElement = (): HTMLElement => TestBed.inject(DOCUMENT).documentElement;

  beforeEach(() => {
    matchMedia = new FakeMatchMedia();
    themeColors = ['(prefers-color-scheme: light)', '(prefers-color-scheme: dark)'].map(media => {
      const meta = document.createElement('meta');
      meta.name = 'theme-color';
      meta.media = media;
      meta.content = '#000000';
      document.head.append(meta);
      return meta;
    });
  });

  afterEach(() => {
    for (const meta of themeColors) {
      meta.remove();
    }
    document.documentElement.removeAttribute('data-color-scheme');
  });

  it('follows a light operating system when the preference is "system"', () => {
    const controller = startController();

    expect(controller.resolvedScheme()).toBe('light');
    expect(documentElement().dataset['colorScheme']).toBe('light');
    expect(themeColors.map(meta => meta.content)).toEqual(['#0e3b4a', '#0e3b4a']);
  });

  it('follows the operating system when it switches to dark', () => {
    const controller = startController();

    matchMedia.setMatches(PREFERS_DARK_COLOR_SCHEME_MEDIA_QUERY, true);
    TestBed.tick();

    expect(controller.resolvedScheme()).toBe('dark');
    expect(documentElement().dataset['colorScheme']).toBe('dark');
    expect(themeColors.map(meta => meta.content)).toEqual(['#06171d', '#06171d']);
  });

  it('lets an explicit preference override the operating system', () => {
    matchMedia = new FakeMatchMedia([PREFERS_DARK_COLOR_SCHEME_MEDIA_QUERY]);

    const controller = startController(storedColorScheme('light'));

    expect(controller.resolvedScheme()).toBe('light');
    expect(documentElement().dataset['colorScheme']).toBe('light');
  });

  it('applies a changed preference immediately', () => {
    const controller = startController();

    TestBed.inject(SettingsStore).update({ colorScheme: 'dark' });
    TestBed.tick();

    expect(controller.resolvedScheme()).toBe('dark');
    expect(documentElement().dataset['colorScheme']).toBe('dark');

    TestBed.inject(SettingsStore).update({ colorScheme: 'system' });
    TestBed.tick();

    expect(documentElement().dataset['colorScheme']).toBe('light');
  });
});
