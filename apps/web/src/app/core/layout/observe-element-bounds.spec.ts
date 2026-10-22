import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
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
