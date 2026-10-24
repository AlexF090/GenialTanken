import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { COMPACT_MEDIA_QUERY } from '../../core/layout/breakpoints';
import { MATCH_MEDIA } from '../../core/layout/media-query';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { hostElementOf, textOf } from '../../../testing/render-page';
import { BottomSheet } from './bottom-sheet';
import type { SnapPosition } from './bottom-sheet-snap';
import { FakeResizeObserver } from '../../../testing/fake-resize-observer';

@Component({
  imports: [BottomSheet],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-bottom-sheet
      label="Tankstellen"
      [(snapPosition)]="snapPosition"
      [contentDragsSheet]="contentDragsSheet()"
      (heightChanged)="heights.push($event)">
      <p bottomSheetHeader>12 Tankstellen</p>
      <a href="/stations/1">TotalEnergies</a>
      <dialog open aria-label="Einstellungen"><button type="button">Fertig</button></dialog>
    </app-bottom-sheet>
  `,
})
class BottomSheetHost {
  readonly snapPosition = signal<SnapPosition>('peek');
  readonly contentDragsSheet = signal(true);
  readonly heights: number[] = [];
}

const render = async ({ isCompact }: { isCompact: boolean }) => {
  vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  TestBed.configureTestingModule({
    providers: [
      {
        provide: MATCH_MEDIA,
        useValue: new FakeMatchMedia(isCompact ? [COMPACT_MEDIA_QUERY] : []).matchMedia,
      },
    ],
  });
  const fixture = TestBed.createComponent(BottomSheetHost);
  await fixture.whenStable();
  const element = hostElementOf(fixture);
  const handle = element.querySelector('button');
  if (handle === null) {
    throw new Error('BottomSheet rendered no handle');
  }
  return { fixture, element, handle, host: fixture.componentInstance };
};

/** A sheet of 800 px, 100 px below the top of the window, whose handle and header take 100 px. */
const layOut = async (element: HTMLElement, settle: () => Promise<unknown>) => {
  const sheet = element.querySelector('section');
  const content = element.querySelector('.bottom-sheet__content');
  if (sheet === null || !(content instanceof HTMLElement)) {
    throw new Error('BottomSheet rendered no sheet');
  }
  Object.defineProperty(sheet, 'offsetHeight', { value: 800 });
  Object.defineProperty(sheet, 'offsetTop', { value: 100 });
  Object.defineProperty(content, 'offsetTop', { value: 100 });
  FakeResizeObserver.latest?.resize();
  await settle();
  return sheet;
};

const pointer = (type: string, clientY: number, timeStamp: number): Event => {
  const event = new MouseEvent(type, { bubbles: true, clientY, button: 0 });
  Object.defineProperties(event, {
    pointerId: { value: 1 },
    timeStamp: { value: timeStamp },
  });
  return event;
};

const touch = (
  type: 'touchstart' | 'touchmove' | 'touchend' | 'touchcancel',
  points: [number, number][],
  timeStamp: number
): Event => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  const list = points.map(([clientX, clientY]) => ({ clientX, clientY }));
  Object.defineProperties(event, {
    touches: { value: type === 'touchend' || type === 'touchcancel' ? [] : list },
    changedTouches: { value: list },
    timeStamp: { value: timeStamp },
  });
  return event;
};

const wheel = (init: WheelEventInit, timeStamp: number): WheelEvent => {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  Object.defineProperty(event, 'timeStamp', { value: timeStamp });
  return event;
};

const contentOf = (element: HTMLElement): HTMLElement => {
  const content = element.querySelector<HTMLElement>('.bottom-sheet__content');
  if (content === null) {
    throw new Error('BottomSheet rendered no content');
  }
  return content;
};

describe('BottomSheet', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is a named region with the header and the content', async () => {
    const { element } = await render({ isCompact: true });
    const region = element.querySelector('section');

    expect(region?.getAttribute('aria-label')).toBe('Tankstellen');
    expect(textOf(region)).toContain('12 Tankstellen');
    expect(textOf(region)).toContain('TotalEnergies');
    expect(region?.hasAttribute('inert')).toBe(false);
  });

  it('starts collapsed with a handle that enlarges the list', async () => {
    const { handle } = await render({ isCompact: true });

    expect(handle.type).toBe('button');
    expect(handle.getAttribute('aria-expanded')).toBe('false');
    expect(handle.getAttribute('aria-label')).toBe('Liste vergrößern');
  });

  it('cycles peek, half, full, half and peek on activation', async () => {
    const { fixture, handle, host } = await render({ isCompact: true });
    const positions: SnapPosition[] = [];
    const labels: (string | null)[] = [];

    for (let step = 0; step < 4; step++) {
      handle.click();
      await fixture.whenStable();
      positions.push(host.snapPosition());
      labels.push(handle.getAttribute('aria-label'));
    }

    expect(positions).toEqual(['half', 'full', 'half', 'peek']);
    expect(labels).toEqual([
      'Liste vergrößern',
      'Liste verkleinern',
      'Liste verkleinern',
      'Liste vergrößern',
    ]);
    expect(handle.getAttribute('aria-expanded')).toBe('false');
  });

  it('steps with the arrow keys and jumps with Home and End', async () => {
    const { fixture, handle, host } = await render({ isCompact: true });
    const press = async (key: string) => {
      handle.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
      await fixture.whenStable();
      return host.snapPosition();
    };

    expect(await press('ArrowUp')).toBe('half');
    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(await press('ArrowUp')).toBe('full');
    expect(await press('ArrowUp')).toBe('full');
    expect(await press('ArrowDown')).toBe('half');
    expect(await press('End')).toBe('full');
    expect(await press('Home')).toBe('peek');
  });

  it('follows the snap position set by the parent', async () => {
    const { fixture, handle, host } = await render({ isCompact: true });

    host.snapPosition.set('full');
    await fixture.whenStable();

    expect(handle.getAttribute('aria-expanded')).toBe('true');
    expect(handle.getAttribute('aria-label')).toBe('Liste verkleinern');
  });

  it('peeks with the strip under the home indicator in addition to handle and header', async () => {
    const { element, fixture } = await render({ isCompact: true });
    const sheet = element.querySelector('section');
    sheet?.style.setProperty('padding-bottom', '34px');

    await layOut(element, () => fixture.whenStable());

    expect(sheet?.style.getPropertyValue('--bottom-sheet-offset')).toBe('666px');
  });

  it('opens to half when focus moves into the content at peek', async () => {
    const { fixture, element, host } = await render({ isCompact: true });

    element.querySelector('a')?.focus();
    await fixture.whenStable();

    expect(host.snapPosition()).toBe('half');
  });

  it('stays down when the focus moves into an open dialog over the page', async () => {
    const { fixture, element, host } = await render({ isCompact: true });

    element.querySelector<HTMLElement>('dialog button')?.focus();
    await fixture.whenStable();

    expect(host.snapPosition()).toBe('peek');
  });

  it('reports the visible height after each snap', async () => {
    const { fixture, element, handle, host } = await render({ isCompact: true });
    await layOut(element, () => fixture.whenStable());

    handle.click();
    await fixture.whenStable();

    expect(host.heights.slice(-2)).toEqual([100, 495]);
  });

  it('opens half to a share of the window, not of the screen strip below it', async () => {
    const { fixture, element, handle, host } = await render({ isCompact: true });
    const sheet = element.querySelector('section');
    const content = element.querySelector('.bottom-sheet__content');
    if (sheet === null || !(content instanceof HTMLElement)) {
      throw new Error('BottomSheet rendered no sheet');
    }
    // A window of 900 px; the sheet reaches 60 px further down into the gap iOS leaves below it.
    sheet.style.bottom = '-60px';
    Object.defineProperty(sheet, 'offsetHeight', { value: 860 });
    Object.defineProperty(sheet, 'offsetTop', { value: 100 });
    Object.defineProperty(content, 'offsetTop', { value: 100 });
    FakeResizeObserver.latest?.resize();
    await fixture.whenStable();

    handle.click();
    await fixture.whenStable();

    expect(host.heights.at(-1)).toBe(495);
  });

  it('slides down by the hidden part of the sheet', async () => {
    const { fixture, element } = await render({ isCompact: true });
    const sheet = await layOut(element, () => fixture.whenStable());

    expect(sheet.style.getPropertyValue('--bottom-sheet-offset')).toBe('700px');
  });

  it('follows a drag and snaps to the nearest position on release', async () => {
    const { fixture, element, handle, host } = await render({ isCompact: true });
    const sheet = await layOut(element, () => fixture.whenStable());
    const setPointerCapture = vi.fn();
    handle.setPointerCapture = setPointerCapture;

    handle.dispatchEvent(pointer('pointerdown', 700, 0));
    handle.dispatchEvent(pointer('pointermove', 400, 1000));
    await fixture.whenStable();

    expect(setPointerCapture).toHaveBeenCalledWith(1);
    expect(sheet.style.getPropertyValue('--bottom-sheet-offset')).toBe('400px');

    handle.dispatchEvent(pointer('pointerup', 400, 1010));
    handle.click();
    await fixture.whenStable();

    expect(host.snapPosition()).toBe('half');
    expect(sheet.style.getPropertyValue('--bottom-sheet-offset')).toBe('305px');
  });

  it('carries a quick flick on to the next position', async () => {
    const { fixture, element, handle, host } = await render({ isCompact: true });
    await layOut(element, () => fixture.whenStable());
    handle.setPointerCapture = vi.fn();

    handle.dispatchEvent(pointer('pointerdown', 700, 0));
    handle.dispatchEvent(pointer('pointermove', 650, 20));
    handle.dispatchEvent(pointer('pointermove', 550, 60));
    handle.dispatchEvent(pointer('pointerup', 550, 70));
    await fixture.whenStable();

    expect(host.snapPosition()).toBe('full');
  });

  it('drops the flick velocity when the finger rested before release', async () => {
    const { fixture, element, handle, host } = await render({ isCompact: true });
    await layOut(element, () => fixture.whenStable());
    handle.setPointerCapture = vi.fn();

    handle.dispatchEvent(pointer('pointerdown', 700, 0));
    handle.dispatchEvent(pointer('pointermove', 650, 20));
    handle.dispatchEvent(pointer('pointermove', 600, 60));
    handle.dispatchEvent(pointer('pointerup', 600, 400));
    await fixture.whenStable();

    expect(host.snapPosition()).toBe('peek');
  });

  it('reports no covered height as a side panel', async () => {
    const { fixture, element, host } = await render({ isCompact: false });
    await layOut(element, () => fixture.whenStable());

    expect(host.heights).toEqual([0]);
  });

  it('tells and restores the scroll position of its content', async () => {
    const { fixture, element } = await render({ isCompact: true });
    const sheet = fixture.debugElement.query(By.directive(BottomSheet))
      .componentInstance as BottomSheet;
    const content = element.querySelector<HTMLElement>('.bottom-sheet__content');
    if (content === null) {
      throw new Error('BottomSheet rendered no content');
    }
    content.scrollTop = 240;

    expect(sheet.scrollPosition()).toBe(240);

    sheet.restoreScrollPosition(0);
    expect(content.scrollTop).toBe(0);

    sheet.restoreScrollPosition(240);
    expect(content.scrollTop).toBe(240);
  });

  describe('content gestures', () => {
    const renderLaidOut = async (position: SnapPosition, isCompact = true) => {
      const rendered = await render({ isCompact });
      const sheet = await layOut(rendered.element, () => rendered.fixture.whenStable());
      rendered.host.snapPosition.set(position);
      await rendered.fixture.whenStable();
      return { ...rendered, sheet, content: contentOf(rendered.element) };
    };

    it('follows an upward swipe on the content at half and settles at full', async () => {
      const { fixture, host, sheet, content } = await renderLaidOut('half');

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      const move = touch('touchmove', [[100, 500]], 50);
      content.dispatchEvent(move);
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(true);
      expect(sheet.classList).toContain('bottom-sheet--dragging');
      expect(sheet.style.getPropertyValue('--bottom-sheet-offset')).toBe('205px');

      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      await fixture.whenStable();

      expect(host.snapPosition()).toBe('full');
      expect(sheet.classList).not.toContain('bottom-sheet--dragging');
    });

    it('does nothing on a horizontal swipe', async () => {
      const { fixture, host, content } = await renderLaidOut('half');

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      const move = touch('touchmove', [[20, 590]], 50);
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[20, 590]], 60));
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('half');
    });

    it('lowers a swipe down from the top of the list at full to half', async () => {
      const { fixture, host, content } = await renderLaidOut('full');

      content.dispatchEvent(touch('touchstart', [[100, 300]], 0));
      const move = touch('touchmove', [[100, 700]], 1000);
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[100, 700]], 1010));
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(true);
      expect(host.snapPosition()).toBe('half');
    });

    it('leaves an upward swipe at full to the list', async () => {
      const { fixture, host, content } = await renderLaidOut('full');

      content.dispatchEvent(touch('touchstart', [[100, 400]], 0));
      const move = touch('touchmove', [[100, 300]], 50);
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[100, 300]], 60));
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('full');
    });

    it('leaves a swipe down in a scrolled list at full to the list', async () => {
      const { fixture, host, content } = await renderLaidOut('full');
      content.scrollTop = 120;

      content.dispatchEvent(touch('touchstart', [[100, 300]], 0));
      const move = touch('touchmove', [[100, 400]], 50);
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[100, 400]], 60));
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('full');
    });

    it('ignores a gesture with two fingers', async () => {
      const { fixture, host, content } = await renderLaidOut('half');

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      const move = touch(
        'touchmove',
        [
          [100, 500],
          [200, 500],
        ],
        50
      );
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('half');
    });

    it('settles from the current height when a second finger joins during the swipe', async () => {
      const { fixture, host, sheet, content } = await renderLaidOut('half');

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 300]], 400));
      content.dispatchEvent(
        touch(
          'touchstart',
          [
            [100, 300],
            [200, 300],
          ],
          500
        )
      );
      content.dispatchEvent(touch('touchend', [[100, 300]], 600));
      await fixture.whenStable();

      expect(host.snapPosition()).toBe('full');
      expect(sheet.classList).not.toContain('bottom-sheet--dragging');
    });

    it('drops the swipe velocity when the finger rested before release', async () => {
      const { fixture, host, content } = await renderLaidOut('half');

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 560]], 20));
      content.dispatchEvent(touch('touchmove', [[100, 500]], 60));
      content.dispatchEvent(touch('touchend', [[100, 500]], 500));
      await fixture.whenStable();

      expect(host.snapPosition()).toBe('half');
    });

    it('returns to the settled position when the browser cancels the swipe', async () => {
      const { fixture, host, sheet, content } = await renderLaidOut('half');

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 500]], 50));
      content.dispatchEvent(touch('touchcancel', [[100, 500]], 60));
      await fixture.whenStable();

      expect(host.snapPosition()).toBe('half');
      expect(sheet.style.getPropertyValue('--bottom-sheet-offset')).toBe('305px');
    });

    it('does nothing when the input switches the content off', async () => {
      const { fixture, host, content } = await renderLaidOut('half');
      host.contentDragsSheet.set(false);
      await fixture.whenStable();

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      const move = touch('touchmove', [[100, 500]], 50);
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      const scroll = wheel({ deltaY: 40 }, 100);
      content.dispatchEvent(scroll);
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(false);
      expect(scroll.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('half');
    });

    it('does nothing as a side panel', async () => {
      const { fixture, host, content } = await renderLaidOut('half', false);

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      const move = touch('touchmove', [[100, 500]], 50);
      content.dispatchEvent(move);
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      const scroll = wheel({ deltaY: 40 }, 100);
      content.dispatchEvent(scroll);
      await fixture.whenStable();

      expect(move.defaultPrevented).toBe(false);
      expect(scroll.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('half');
    });

    it.each([
      ['peek', true],
      ['half', true],
      ['full', false],
    ] as const)('marks the content as leading to the sheet at %s: %s', async (position, leads) => {
      const { sheet } = await renderLaidOut(position);

      expect(sheet.classList.contains('bottom-sheet--content-leads')).toBe(leads);
    });

    it('does not mark the content when the input is off or as a side panel', async () => {
      const off = await renderLaidOut('half');
      off.host.contentDragsSheet.set(false);
      await off.fixture.whenStable();
      expect(off.sheet.classList).not.toContain('bottom-sheet--content-leads');
      TestBed.resetTestingModule();

      const panel = await renderLaidOut('half', false);
      expect(panel.sheet.classList).not.toContain('bottom-sheet--content-leads');
    });

    it('opens fully on a mouse wheel down at half and locks against trackpad momentum', async () => {
      const { fixture, host, content } = await renderLaidOut('half');

      const first = wheel({ deltaY: 40 }, 1000);
      content.dispatchEvent(first);
      await fixture.whenStable();
      const trailing = wheel({ deltaY: 30 }, 1100);
      content.dispatchEvent(trailing);
      await fixture.whenStable();

      expect(first.defaultPrevented).toBe(true);
      expect(trailing.defaultPrevented).toBe(true);
      expect(host.snapPosition()).toBe('full');
    });

    it('lowers to half on a mouse wheel up at full from the top of the list', async () => {
      const { fixture, host, content } = await renderLaidOut('full');

      const event = wheel({ deltaY: -40 }, 1000);
      content.dispatchEvent(event);
      await fixture.whenStable();

      expect(event.defaultPrevented).toBe(true);
      expect(host.snapPosition()).toBe('half');
    });

    it('lets the list scroll with the wheel at full and ignores pinch zoom', async () => {
      const { fixture, host, content } = await renderLaidOut('full');
      content.scrollTop = 120;

      const scroll = wheel({ deltaY: -40 }, 1000);
      content.dispatchEvent(scroll);
      const pinch = wheel({ deltaY: -40, ctrlKey: true }, 2000);
      content.dispatchEvent(pinch);
      await fixture.whenStable();

      expect(scroll.defaultPrevented).toBe(false);
      expect(pinch.defaultPrevented).toBe(false);
      expect(host.snapPosition()).toBe('full');
    });

    it('swallows the click that follows a dragged touch, once', async () => {
      const { fixture, content } = await renderLaidOut('half');
      const link = content.querySelector('a');
      if (link === null) {
        throw new Error('No link in the content');
      }
      const clicked = vi.fn((event: Event) => {
        event.preventDefault();
      });
      link.addEventListener('click', clicked);
      const click = (timeStamp: number): Event => {
        const event = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
        Object.defineProperty(event, 'timeStamp', { value: timeStamp });
        return event;
      };

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 500]], 50));
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      await fixture.whenStable();
      link.dispatchEvent(click(70));
      link.dispatchEvent(click(80));

      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('lets a keyboard click through right after a dragged touch', async () => {
      const { fixture, content } = await renderLaidOut('half');
      const link = content.querySelector('a');
      if (link === null) {
        throw new Error('No link in the content');
      }
      const clicked = vi.fn((event: Event) => {
        event.preventDefault();
      });
      link.addEventListener('click', clicked);

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 500]], 50));
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      await fixture.whenStable();
      const keyboardClick = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 0 });
      Object.defineProperty(keyboardClick, 'timeStamp', { value: 70 });
      link.dispatchEvent(keyboardClick);

      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('lets a click through that lands outside the element the swipe started on', async () => {
      const { fixture, content } = await renderLaidOut('half');
      const link = content.querySelector('a');
      if (link === null) {
        throw new Error('No link in the content');
      }
      const clicked = vi.fn();
      content.addEventListener('click', clicked);

      link.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 500]], 50));
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      await fixture.whenStable();
      const click = new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 });
      Object.defineProperty(click, 'timeStamp', { value: 70 });
      content.dispatchEvent(click);

      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('lets a click through that comes long after a dragged touch', async () => {
      const { fixture, content } = await renderLaidOut('half');
      const link = content.querySelector('a');
      if (link === null) {
        throw new Error('No link in the content');
      }
      const clicked = vi.fn((event: Event) => {
        event.preventDefault();
      });
      link.addEventListener('click', clicked);

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchmove', [[100, 500]], 50));
      content.dispatchEvent(touch('touchend', [[100, 500]], 60));
      await fixture.whenStable();
      const later = new MouseEvent('click', { bubbles: true, cancelable: true });
      Object.defineProperty(later, 'timeStamp', { value: 5000 });
      link.dispatchEvent(later);

      expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('lets a tap through that moved the sheet nowhere', async () => {
      const { fixture, content } = await renderLaidOut('half');
      const link = content.querySelector('a');
      if (link === null) {
        throw new Error('No link in the content');
      }
      const clicked = vi.fn((event: Event) => {
        event.preventDefault();
      });
      link.addEventListener('click', clicked);

      content.dispatchEvent(touch('touchstart', [[100, 600]], 0));
      content.dispatchEvent(touch('touchend', [[100, 600]], 50));
      await fixture.whenStable();
      const click = new MouseEvent('click', { bubbles: true, cancelable: true });
      Object.defineProperty(click, 'timeStamp', { value: 60 });
      link.dispatchEvent(click);

      expect(clicked).toHaveBeenCalledTimes(1);
    });
  });
});
