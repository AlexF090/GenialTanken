import { ChangeDetectionStrategy, Component, signal, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { observeElementBounds } from './observe-element-bounds';
import { hostElementOf } from '../../../testing/render-page';
import { FakeResizeObserver } from '../../../testing/fake-resize-observer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #box></div>`,
})
class ObservingHost {
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  readonly boxBounds = observeElementBounds(() => this.box().nativeElement);
}

/** Replaces the observed element, like a re-rendered view (e.g. hot module replacement). */
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `@if (isFirstBox()) {
      <div #box class="first"></div>
    } @else {
      <div #box class="second"></div>
    }`,
})
class ReplacingHost {
  readonly isFirstBox = signal(true);
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  readonly boxBounds = observeElementBounds(() => this.box().nativeElement);
}

const boxOf = (element: HTMLElement, selector: string): HTMLElement => {
  const box = element.querySelector<HTMLElement>(selector);
  if (box === null) {
    throw new Error(`No ${selector} rendered`);
  }
  return box;
};

const render = async () => {
  const fixture = TestBed.createComponent(ObservingHost);
  await fixture.whenStable();
  const box = hostElementOf(fixture).querySelector('div');
  if (box === null) {
    throw new Error('No box rendered');
  }
  return { fixture, box };
};

const layOut = (box: HTMLElement, rectangle: DOMRect): void => {
  vi.spyOn(box, 'getBoundingClientRect').mockReturnValue(rectangle);
  FakeResizeObserver.latest?.resize();
};

describe('observeElementBounds', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('follows where the element lies whenever it or the window resizes', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { fixture, box } = await render();

    expect(fixture.componentInstance.boxBounds()).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
    expect(FakeResizeObserver.latest?.observedElements).toEqual([box, document.documentElement]);

    layOut(box, new DOMRect(16, 59, 400, 52));
    expect(fixture.componentInstance.boxBounds()).toEqual({
      top: 59,
      right: 416,
      bottom: 111,
      left: 16,
    });
  });

  it('follows an element that replaced the observed one', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const fixture = TestBed.createComponent(ReplacingHost);
    await fixture.whenStable();
    const firstObserver = FakeResizeObserver.latest;

    fixture.componentInstance.isFirstBox.set(false);
    await fixture.whenStable();
    const secondBox = boxOf(hostElementOf(fixture), '.second');
    layOut(secondBox, new DOMRect(16, 16, 400, 900));

    expect(firstObserver?.isDisconnected).toBe(true);
    expect(FakeResizeObserver.latest?.observedElements).toEqual([
      secondBox,
      document.documentElement,
    ]);
    expect(fixture.componentInstance.boxBounds()).toEqual({
      top: 16,
      right: 416,
      bottom: 916,
      left: 16,
    });
  });

  it('keeps the last bounds when the element left the page', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { fixture, box } = await render();
    layOut(box, new DOMRect(16, 59, 400, 52));

    box.remove();
    layOut(box, new DOMRect(0, 0, 0, 0));

    expect(fixture.componentInstance.boxBounds()).toEqual({
      top: 59,
      right: 416,
      bottom: 111,
      left: 16,
    });
  });

  it('stops observing when the component is destroyed', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { fixture } = await render();

    fixture.destroy();

    expect(FakeResizeObserver.latest?.isDisconnected).toBe(true);
  });

  it('stays at 0 without ResizeObserver', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { fixture } = await render();

    expect(fixture.componentInstance.boxBounds().bottom).toBe(0);
  });
});
