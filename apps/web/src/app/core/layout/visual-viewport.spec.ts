import {
  createEnvironmentInjector,
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FakeKeyboardAwareWindow } from '../../../testing/fake-visual-viewport';
import {
  injectKeyboardInset,
  KEYBOARD_AWARE_WINDOW,
  KEYBOARD_INSET_PROPERTY,
  keyboardInsetFor,
} from './visual-viewport';

const insetProperty = (): string =>
  document.documentElement.style.getPropertyValue(KEYBOARD_INSET_PROPERTY);

describe('keyboardInsetFor', () => {
  it('is the part of the layout viewport below the visual viewport', () => {
    expect(keyboardInsetFor(800, { height: 500, offsetTop: 0 })).toBe(300);
    expect(keyboardInsetFor(800, { height: 500, offsetTop: 120 })).toBe(180);
  });

  it('is never negative, e.g. while the page is pinch-zoomed and scrolled', () => {
    expect(keyboardInsetFor(800, { height: 400, offsetTop: 500 })).toBe(0);
  });

  it('rounds to whole pixels', () => {
    expect(keyboardInsetFor(800, { height: 499.6, offsetTop: 0 })).toBe(300);
  });
});

describe('injectKeyboardInset', () => {
  let fakeWindow: FakeKeyboardAwareWindow;
  let injector: EnvironmentInjector | undefined;

  const start = (window: FakeKeyboardAwareWindow | null = fakeWindow) => {
    TestBed.configureTestingModule({
      providers: [{ provide: KEYBOARD_AWARE_WINDOW, useValue: window }],
    });
    const environmentInjector = createEnvironmentInjector([], TestBed.inject(EnvironmentInjector));
    injector = environmentInjector;
    return runInInjectionContext(environmentInjector, () => injectKeyboardInset());
  };

  beforeEach(() => {
    fakeWindow = new FakeKeyboardAwareWindow(800);
  });

  afterEach(() => {
    injector?.destroy();
    injector = undefined;
    document.body.replaceChildren();
  });

  it('starts at 0 without a keyboard', () => {
    const inset = start();

    expect(inset()).toBe(0);
    expect(insetProperty()).toBe('0px');
  });

  it('follows the keyboard and writes the inset for the stylesheets', () => {
    const inset = start();

    fakeWindow.openKeyboard(320);
    expect(inset()).toBe(320);
    expect(insetProperty()).toBe('320px');

    fakeWindow.closeKeyboard();
    expect(inset()).toBe(0);
    expect(insetProperty()).toBe('0px');
  });

  it('scrolls the page back when iOS moved it to reveal a focused text field', () => {
    start();
    const field = document.createElement('input');
    document.body.append(field);
    field.focus();

    fakeWindow.scrollY = 140;
    fakeWindow.visualViewport.dispatch('scroll');

    expect(fakeWindow.scrollCalls).toEqual([[0, 0]]);
  });

  it('leaves the page alone without a focused text field or when it is not scrolled', () => {
    start();
    fakeWindow.scrollY = 140;
    fakeWindow.visualViewport.dispatch('scroll');

    const field = document.createElement('input');
    document.body.append(field);
    field.focus();
    fakeWindow.scrollY = 0;
    fakeWindow.visualViewport.dispatch('scroll');

    expect(fakeWindow.scrollCalls).toEqual([]);
  });

  it('stops listening and removes the inset when its injector is destroyed', () => {
    start();
    fakeWindow.openKeyboard(320);

    injector?.destroy();
    injector = undefined;

    expect(fakeWindow.visualViewport.listenerCount).toBe(0);
    expect(insetProperty()).toBe('');
  });

  it('stays at 0 where the browser has no visual viewport', () => {
    const inset = start(null);

    expect(inset()).toBe(0);
    expect(insetProperty()).toBe('');
  });
});
