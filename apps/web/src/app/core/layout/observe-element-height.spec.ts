import { ChangeDetectionStrategy, Component, viewChild } from '@angular/core';
import type { ElementRef } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { observeElementHeight } from './observe-element-height';
import { hostElementOf } from '../../../testing/render-page';
import { FakeResizeObserver } from '../../../testing/fake-resize-observer';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div #box></div>`,
})
class ObservingHost {
  private readonly box = viewChild.required<ElementRef<HTMLElement>>('box');
  readonly boxHeightInPixels = observeElementHeight(() => this.box().nativeElement);
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

const resizeTo = (box: HTMLElement, heightInPixels: number): void => {
  Object.defineProperty(box, 'offsetHeight', { value: heightInPixels, configurable: true });
  FakeResizeObserver.latest?.resize();
};

describe('observeElementHeight', () => {
  afterEach(() => {
    FakeResizeObserver.latest = undefined;
    vi.unstubAllGlobals();
  });

  it('follows the height of the element whenever it resizes', async () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { fixture, box } = await render();

    expect(fixture.componentInstance.boxHeightInPixels()).toBe(0);
    expect(FakeResizeObserver.latest?.observedElements).toEqual([box]);

    resizeTo(box, 72);
    expect(fixture.componentInstance.boxHeightInPixels()).toBe(72);

    resizeTo(box, 120);
    expect(fixture.componentInstance.boxHeightInPixels()).toBe(120);
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

    expect(fixture.componentInstance.boxHeightInPixels()).toBe(0);
  });
});
