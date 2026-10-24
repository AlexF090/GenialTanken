import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  input,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { observeElementResize } from '../../core/layout/observe-element-resize';
import { Viewport } from '../../core/layout/viewport';
import {
  nearestSnapPosition,
  nextSnapPositionOnActivation,
  SNAP_POSITIONS,
  snapHeights,
  steppedSnapPosition,
} from './bottom-sheet-snap';
import type { SnapDirection, SnapPosition } from './bottom-sheet-snap';
import { contentGestureDecision, wheelTarget } from './bottom-sheet-gesture';
import type { ContentGestureDecision, WheelLock } from './bottom-sheet-gesture';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';

/** Movement in pixels below which a press on the handle counts as a click, not a drag. */
const DRAG_THRESHOLD_IN_PIXELS = 4;

/** A mouse or touch click this soon after a touch that dragged the sheet is not meant for the content. */
const CLICK_SUPPRESSION_IN_MILLISECONDS = 400;

/** A pause this long before release means the finger stopped, so the release flings nothing. */
const STALE_VELOCITY_IN_MILLISECONDS = 100;

/** The vertical movement of a finger or pointer that drags the sheet. */
interface DragState {
  startY: number;
  startVisibleHeight: number;
  lastY: number;
  lastTimestamp: number;
  /** Pixels per millisecond, positive while the sheet grows. */
  velocity: number;
}

interface HandleDrag {
  pointerId: number;
  hasMoved: boolean;
  drag: DragState;
}

interface ContentGesture {
  startX: number;
  startScrollTop: number;
  decision: ContentGestureDecision;
  /** Where the finger went down; only a click on this element can follow the swipe. */
  startTarget: EventTarget | null;
  drag: DragState;
}

/**
 * List container that floats over the map on phones with three snap positions (peek, half,
 * full), from the bottom edge of the window up to just below the status bar, and becomes a
 * floating side panel from 48rem. The content is never inert: screen readers
 * reach it in every position, and focusing it from peek opens the sheet to half.
 */
@Component({
  selector: 'app-bottom-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './bottom-sheet.html',
  styleUrl: './bottom-sheet.scss',
})
export class BottomSheet {
  readonly snapPosition = model<SnapPosition>('peek');
  /** Accessible name of the sheet region, e.g. "Tankstellen". */
  readonly label = input.required<string>();
  /**
   * Whether swiping or scrolling the list moves the sheet between its positions. The page turns
   * it off where the list must not lead, e.g. while searching.
   */
  readonly contentDragsSheet = input(true);
  /**
   * Height in pixels the sheet covers at the bottom of the map after it settled; 0 when it is a
   * side panel. Use it as bottom padding when fitting the map to its markers.
   */
  readonly heightChanged = output<number>();

  protected readonly contentIdentifier = uniqueIdentifier('bottom-sheet-content');

  private readonly isCompactViewport = inject(Viewport).isCompactViewport;
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  private readonly sheetHeight = signal(0);
  private readonly peekHeight = signal(0);
  private readonly windowHeight = signal(0);
  private readonly dragHeight = signal<number | null>(null);
  private readonly direction = signal<SnapDirection>('up');
  private handleDrag: HandleDrag | undefined;
  private contentGesture: ContentGesture | undefined;
  private suppressesNextClick = false;
  private contentClickSuppression: { until: number; target: EventTarget | null } | undefined;
  private wheelLock: WheelLock | undefined;

  private readonly heights = computed(() =>
    snapHeights({
      sheetHeight: this.sheetHeight(),
      peekHeight: this.peekHeight(),
      windowHeight: this.windowHeight(),
    })
  );
  private readonly settledVisibleHeight = computed(() => this.heights()[this.snapPosition()]);
  private readonly visibleHeight = computed(() => this.dragHeight() ?? this.settledVisibleHeight());

  protected readonly isMeasured = signal(false);
  protected readonly isDragging = computed(() => this.dragHeight() !== null);
  protected readonly offset = computed(() => this.sheetHeight() - this.visibleHeight());
  protected readonly settledOffset = computed(
    () => this.sheetHeight() - this.settledVisibleHeight()
  );
  protected readonly isContentDraggingEnabled = computed(
    () => this.isCompactViewport() && this.contentDragsSheet()
  );
  protected readonly contentLeadsToSheet = computed(
    () => this.isContentDraggingEnabled() && this.snapPosition() !== 'full'
  );
  protected readonly isExpanded = computed(() => this.snapPosition() !== 'peek');
  private readonly nextActivation = computed(() =>
    nextSnapPositionOnActivation(this.snapPosition(), this.direction())
  );
  protected readonly handleLabel = computed(() =>
    this.nextActivation().direction === 'up' ? 'Liste vergrößern' : 'Liste verkleinern'
  );

  constructor() {
    const destroyRef = inject(DestroyRef);
    afterNextRender(() => {
      this.measure();
      requestAnimationFrame(() => {
        this.isMeasured.set(true);
      });
      observeElementResize(
        [this.sheet().nativeElement, this.header().nativeElement],
        () => {
          this.measure();
        },
        destroyRef
      );
      this.listenToContent(destroyRef);
    });

    let lastEmittedHeight: number | undefined;
    effect(() => {
      const height = this.isCompactViewport() ? this.settledVisibleHeight() : 0;
      if (height !== lastEmittedHeight) {
        lastEmittedHeight = height;
        this.heightChanged.emit(height);
      }
    });
  }

  /** How far the content is scrolled, e.g. to return there after showing something else. */
  scrollPosition(): number {
    return this.content().nativeElement.scrollTop;
  }

  restoreScrollPosition(position: number): void {
    this.content().nativeElement.scrollTop = position;
  }

  protected activateHandle(): void {
    if (this.suppressesNextClick) {
      this.suppressesNextClick = false;
      return;
    }
    const { position, direction } = this.nextActivation();
    this.direction.set(direction);
    this.snapPosition.set(position);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    this.suppressesNextClick = false;
    const position = this.snapPosition();
    const targets: Partial<Record<string, SnapPosition>> = {
      ArrowUp: steppedSnapPosition(position, 'up'),
      ArrowDown: steppedSnapPosition(position, 'down'),
      Home: 'peek',
      End: 'full',
    };
    const target = targets[event.key];
    if (target === undefined) {
      return;
    }
    event.preventDefault();
    this.moveTo(target);
  }

  protected startDrag(event: PointerEvent): void {
    this.suppressesNextClick = false;
    if (!this.isCompactViewport() || event.button !== 0) {
      return;
    }
    if (event.currentTarget instanceof Element) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    this.handleDrag = {
      pointerId: event.pointerId,
      hasMoved: false,
      drag: this.beginDrag(event.clientY, event.timeStamp),
    };
  }

  protected drag(event: PointerEvent): void {
    const state = this.handleDrag;
    if (state?.pointerId !== event.pointerId) {
      return;
    }
    if (!state.hasMoved && Math.abs(event.clientY - state.drag.startY) < DRAG_THRESHOLD_IN_PIXELS) {
      return;
    }
    state.hasMoved = true;
    this.moveDrag(state.drag, event.clientY, event.timeStamp);
  }

  protected endDrag(event: PointerEvent): void {
    const state = this.handleDrag;
    if (state?.pointerId !== event.pointerId) {
      return;
    }
    this.handleDrag = undefined;
    if (!state.hasMoved) {
      this.dragHeight.set(null);
      return;
    }
    this.suppressesNextClick = true;
    this.settleDrag(state.drag, event.timeStamp);
  }

  protected cancelDrag(): void {
    this.handleDrag = undefined;
    this.dragHeight.set(null);
  }

  /**
   * Keyboard and screen reader users must not land on content hidden below the screen. A modal
   * dialog opened from the content (the settings) shows over the page, not in the sheet.
   */
  protected revealFocusedContent(event: FocusEvent): void {
    if (
      this.isCompactViewport() &&
      this.snapPosition() === 'peek' &&
      event.target instanceof Element &&
      event.target.closest('dialog[open]') === null &&
      this.content().nativeElement.contains(event.target)
    ) {
      this.moveTo('half');
    }
  }

  private beginDrag(clientY: number, timeStamp: number): DragState {
    return {
      startY: clientY,
      startVisibleHeight: this.visibleHeight(),
      lastY: clientY,
      lastTimestamp: timeStamp,
      velocity: 0,
    };
  }

  private moveDrag(state: DragState, clientY: number, timeStamp: number): void {
    const elapsed = timeStamp - state.lastTimestamp;
    if (elapsed > 0) {
      state.velocity = (state.lastY - clientY) / elapsed;
    }
    state.lastY = clientY;
    state.lastTimestamp = timeStamp;
    const { peek, full } = this.heights();
    this.dragHeight.set(
      Math.min(Math.max(state.startVisibleHeight - (clientY - state.startY), peek), full)
    );
  }

  private settleDrag(state: DragState, releaseTimeStamp: number): void {
    if (releaseTimeStamp - state.lastTimestamp > STALE_VELOCITY_IN_MILLISECONDS) {
      state.velocity = 0;
    }
    const dragHeight = this.dragHeight();
    this.dragHeight.set(null);
    if (dragHeight === null) {
      return;
    }
    this.moveTo(
      nearestSnapPosition({
        visibleHeight: dragHeight,
        velocity: state.velocity,
        heights: this.heights(),
      })
    );
  }

  /**
   * The touchmove and wheel listeners are not passive: a claimed swipe and a wheel step must keep
   * the list from scrolling, which a passive listener cannot do.
   */
  private listenToContent(destroyRef: DestroyRef): void {
    const content = this.content().nativeElement;
    const listen = <Type extends keyof HTMLElementEventMap>(
      type: Type,
      listener: (event: HTMLElementEventMap[Type]) => void,
      options?: AddEventListenerOptions
    ): void => {
      content.addEventListener(type, listener, options);
      destroyRef.onDestroy(() => {
        content.removeEventListener(type, listener, options);
      });
    };
    listen('touchstart', event => {
      this.startContentGesture(event);
    });
    listen(
      'touchmove',
      event => {
        this.moveContentGesture(event);
      },
      { passive: false }
    );
    listen('touchend', event => {
      this.endContentGesture(event);
    });
    listen('touchcancel', () => {
      this.cancelContentGesture();
    });
    listen(
      'wheel',
      event => {
        this.stepWithWheel(event);
      },
      { passive: false }
    );
    listen(
      'click',
      event => {
        this.swallowClickAfterDrag(event);
      },
      { capture: true }
    );
  }

  private startContentGesture(event: TouchEvent): void {
    this.abandonContentGesture();
    const touch = event.touches[0];
    if (!this.isContentDraggingEnabled() || event.touches.length !== 1 || touch === undefined) {
      return;
    }
    this.contentGesture = {
      startX: touch.clientX,
      startScrollTop: this.content().nativeElement.scrollTop,
      decision: 'undecided',
      startTarget: event.target,
      drag: this.beginDrag(touch.clientY, event.timeStamp),
    };
  }

  private moveContentGesture(event: TouchEvent): void {
    const gesture = this.contentGesture;
    const touch = event.touches[0];
    if (gesture === undefined) {
      return;
    }
    if (event.touches.length !== 1 || touch === undefined) {
      this.abandonContentGesture();
      return;
    }
    if (gesture.decision === 'undecided') {
      gesture.decision = contentGestureDecision({
        position: this.snapPosition(),
        startScrollTop: gesture.startScrollTop,
        dx: touch.clientX - gesture.startX,
        dy: touch.clientY - gesture.drag.startY,
        threshold: DRAG_THRESHOLD_IN_PIXELS,
      });
      // A touch the browser already scrolls with cannot be taken over any more.
      if (gesture.decision === 'claim' && !event.cancelable) {
        gesture.decision = 'release';
      }
    }
    if (gesture.decision !== 'claim') {
      return;
    }
    event.preventDefault();
    this.moveDrag(gesture.drag, touch.clientY, event.timeStamp);
  }

  private endContentGesture(event: TouchEvent): void {
    const gesture = this.contentGesture;
    this.contentGesture = undefined;
    if (gesture?.decision !== 'claim') {
      return;
    }
    this.contentClickSuppression = {
      until: event.timeStamp + CLICK_SUPPRESSION_IN_MILLISECONDS,
      target: gesture.startTarget,
    };
    this.settleDrag(gesture.drag, event.timeStamp);
  }

  /** A second finger ends the swipe where it is: the sheet snaps from its current height. */
  private abandonContentGesture(): void {
    const gesture = this.contentGesture;
    if (gesture?.decision !== 'claim') {
      this.cancelContentGesture();
      return;
    }
    this.contentGesture = undefined;
    gesture.drag.velocity = 0;
    this.settleDrag(gesture.drag, gesture.drag.lastTimestamp);
  }

  private cancelContentGesture(): void {
    this.contentGesture = undefined;
    this.dragHeight.set(null);
  }

  private swallowClickAfterDrag(event: MouseEvent): void {
    const suppression = this.contentClickSuppression;
    this.contentClickSuppression = undefined;
    if (
      suppression === undefined ||
      event.detail === 0 ||
      event.timeStamp > suppression.until ||
      !(suppression.target instanceof Node) ||
      !(event.target instanceof Node) ||
      !suppression.target.contains(event.target)
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
  }

  private stepWithWheel(event: WheelEvent): void {
    if (!this.isContentDraggingEnabled()) {
      return;
    }
    const { target, swallow, lock } = wheelTarget({
      position: this.snapPosition(),
      scrollTop: this.content().nativeElement.scrollTop,
      deltaY: event.deltaY,
      deltaMode: event.deltaMode,
      ctrlKey: event.ctrlKey,
      timeStamp: event.timeStamp,
      lock: this.wheelLock,
    });
    this.wheelLock = lock;
    if (swallow) {
      event.preventDefault();
    }
    if (target !== null) {
      this.moveTo(target);
    }
  }

  private moveTo(position: SnapPosition): void {
    const current = SNAP_POSITIONS.indexOf(this.snapPosition());
    const target = SNAP_POSITIONS.indexOf(position);
    if (target !== current) {
      this.direction.set(target > current ? 'up' : 'down');
    }
    this.snapPosition.set(position);
  }

  private measure(): void {
    const sheet = this.sheet().nativeElement;
    this.sheetHeight.set(sheet.offsetHeight);
    // Fixed to the window: top and height add up to the window's height, plus the strip below
    // the window that iOS leaves and the sheet reaches into (its negative `bottom`).
    const bottom = Number.parseFloat(getComputedStyle(sheet).bottom);
    this.windowHeight.set(
      sheet.offsetTop + sheet.offsetHeight + (Number.isNaN(bottom) ? 0 : Math.min(bottom, 0))
    );
    // Handle and header stay visible at peek; the content starts right below them. The sheet
    // reaches under the home indicator, so peek shows that strip (its bottom padding) as well.
    const safeAreaBottom = Number.parseFloat(getComputedStyle(sheet).paddingBottom);
    this.peekHeight.set(
      this.content().nativeElement.offsetTop + (Number.isNaN(safeAreaBottom) ? 0 : safeAreaBottom)
    );
  }
}
