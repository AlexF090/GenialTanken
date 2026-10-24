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
      (heightChanged)="heights.push($event)">
      <p bottomSheetHeader>12 Tankstellen</p>
      <a href="/stations/1">TotalEnergies</a>
      <dialog open aria-label="Einstellungen"><button type="button">Fertig</button></dialog>
    </app-bottom-sheet>
  `,
})
class BottomSheetHost {
  readonly snapPosition = signal<SnapPosition>('peek');
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
});
