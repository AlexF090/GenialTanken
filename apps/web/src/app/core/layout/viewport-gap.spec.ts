import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeStandaloneWindow } from '../../../testing/fake-visual-viewport';
import {
  injectViewportGapBottom,
  STANDALONE_WINDOW,
  VIEWPORT_GAP_BOTTOM_PROPERTY,
  viewportGapBottomFor,
} from './viewport-gap';

const IPHONE_SCREEN = { width: 402, height: 874 };

const gapProperty = (): string =>
  document.documentElement.style.getPropertyValue(VIEWPORT_GAP_BOTTOM_PROPERTY);

describe('viewportGapBottomFor', () => {
  it('is the part of the screen below a layout viewport that ends short of it', () => {
    expect(viewportGapBottomFor(IPHONE_SCREEN, { width: 402, height: 815 })).toBe(59);
  });

  it('compares with the shorter side of the screen in landscape', () => {
    expect(viewportGapBottomFor(IPHONE_SCREEN, { width: 874, height: 340 })).toBe(62);
  });

  it('is 0 when the layout viewport reaches the bottom of the screen', () => {
    expect(viewportGapBottomFor(IPHONE_SCREEN, { width: 402, height: 874 })).toBe(0);
    expect(viewportGapBottomFor(IPHONE_SCREEN, { width: 402, height: 880 })).toBe(0);
  });

  it('ignores differences too large for the bug, e.g. a keyboard that resized the layout', () => {
    expect(viewportGapBottomFor(IPHONE_SCREEN, { width: 402, height: 520 })).toBe(0);
  });

  it('rounds to whole pixels', () => {
    expect(viewportGapBottomFor(IPHONE_SCREEN, { width: 402, height: 814.6 })).toBe(59);
  });
});

describe('injectViewportGapBottom', () => {
  let fakeWindow: FakeStandaloneWindow;
  let injector: EnvironmentInjector | undefined;

  const start = (window: FakeStandaloneWindow | null = fakeWindow): void => {
    TestBed.configureTestingModule({
      providers: [{ provide: STANDALONE_WINDOW, useValue: window }],
    });
    const environmentInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    injector = environmentInjector;
    runInInjectionContext(environmentInjector, () => {
      injectViewportGapBottom();
    });
  };

  beforeEach(() => {
    fakeWindow = new FakeStandaloneWindow(IPHONE_SCREEN);
  });

  afterEach(() => {
    injector?.destroy();
    injector = undefined;
  });

  it('writes 0 while the layout viewport fills the screen', () => {
    start();

    expect(gapProperty()).toBe('0px');
  });

  it('writes the gap the installed app leaves at the bottom from the start', () => {
    fakeWindow.shrinkLayoutViewport(59);

    start();

    expect(gapProperty()).toBe('59px');
  });

  it('measures again once the keyboard closed and left the layout viewport short', () => {
    start();

    fakeWindow.openKeyboard(336);
    fakeWindow.shrinkLayoutViewport(59);
    expect(gapProperty()).toBe('0px');

    fakeWindow.closeKeyboard();
    expect(gapProperty()).toBe('59px');
  });

  it('does not take an open keyboard for the gap', () => {
    fakeWindow.shrinkLayoutViewport(59);
    start();

    fakeWindow.openKeyboard(336);

    expect(gapProperty()).toBe('59px');
  });

  it('measures again when the app returns to the foreground', () => {
    start();
    fakeWindow.shrinkLayoutViewport(59, { notify: false });

    document.dispatchEvent(new Event('visibilitychange'));

    expect(gapProperty()).toBe('59px');
  });

  it('stops listening and removes the gap when its injector is destroyed', () => {
    fakeWindow.shrinkLayoutViewport(59);
    start();

    injector?.destroy();
    injector = undefined;

    expect(fakeWindow.visualViewport.listenerCount).toBe(0);
    expect(gapProperty()).toBe('');
  });

  it('writes nothing outside an installed app on iOS', () => {
    start(null);

    expect(gapProperty()).toBe('');
  });
});
