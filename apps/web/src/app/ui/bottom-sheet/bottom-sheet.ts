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
import { Viewport } from '../../core/layout/viewport';
import {
  nearestSnapPosition,
  nextSnapPositionOnActivation,
  SNAP_POSITIONS,
  snapHeights,
  steppedSnapPosition,
} from './bottom-sheet-snap';
import type { SnapDirection, SnapPosition } from './bottom-sheet-snap';

/** Movement in pixels below which a press on the handle counts as a click, not a drag. */
const DRAG_THRESHOLD_IN_PIXELS = 4;

interface DragState {
  pointerId: number;
  startPointerY: number;
  startVisibleHeight: number;
  lastPointerY: number;
  lastTimestamp: number;
  /** Pixels per millisecond, positive while the sheet grows. */
  velocity: number;
  hasMoved: boolean;
}

let nextIdentifier = 0;

/**
 * List container that floats over the map on phones with three snap positions (peek, half,
 * full) and becomes a static side panel from 48rem. The content is never inert: screen readers
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
   * Height in pixels the sheet covers at the bottom of the map after it settled; 0 when it is a
   * side panel. Use it as bottom padding when fitting the map to its markers.
   */
  readonly heightChanged = output<number>();

  protected readonly contentIdentifier = `bottom-sheet-content-${String(nextIdentifier++)}`;

  private readonly isCompactViewport = inject(Viewport).isCompactViewport;
  private readonly sheet = viewChild.required<ElementRef<HTMLElement>>('sheet');
  private readonly header = viewChild.required<ElementRef<HTMLElement>>('header');
  private readonly content = viewChild.required<ElementRef<HTMLElement>>('content');

  private readonly sheetHeight = signal(0);
  private readonly peekHeight = signal(0);
  private readonly dragHeight = signal<number | null>(null);
  private readonly direction = signal<SnapDirection>('up');
  private dragState: DragState | undefined;
  private suppressesNextClick = false;

  private readonly heights = computed(() =>
    snapHeights({ sheetHeight: this.sheetHeight(), peekHeight: this.peekHeight() })
  );
  private readonly settledVisibleHeight = computed(() => this.heights()[this.snapPosition()]);
  private readonly visibleHeight = computed(() => this.dragHeight() ?? this.settledVisibleHeight());

  protected readonly isMeasured = signal(false);
  protected readonly isDragging = computed(() => this.dragHeight() !== null);
  protected readonly offset = computed(() => this.sheetHeight() - this.visibleHeight());
  protected readonly settledOffset = computed(
    () => this.sheetHeight() - this.settledVisibleHeight()
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
      if (typeof ResizeObserver !== 'function') {
        return;
      }
      const observer = new ResizeObserver(() => {
        this.measure();
      });
      observer.observe(this.sheet().nativeElement);
      observer.observe(this.header().nativeElement);
      destroyRef.onDestroy(() => {
        observer.disconnect();
      });
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
    this.dragState = {
      pointerId: event.pointerId,
      startPointerY: event.clientY,
      startVisibleHeight: this.visibleHeight(),
      lastPointerY: event.clientY,
      lastTimestamp: event.timeStamp,
      velocity: 0,
      hasMoved: false,
    };
  }

  protected drag(event: PointerEvent): void {
    const state = this.dragState;
    if (state?.pointerId !== event.pointerId) {
      return;
    }
    const distance = event.clientY - state.startPointerY;
    if (!state.hasMoved && Math.abs(distance) < DRAG_THRESHOLD_IN_PIXELS) {
      return;
    }
    state.hasMoved = true;
    const elapsed = event.timeStamp - state.lastTimestamp;
    if (elapsed > 0) {
      state.velocity = (state.lastPointerY - event.clientY) / elapsed;
    }
    state.lastPointerY = event.clientY;
    state.lastTimestamp = event.timeStamp;
    const { peek, full } = this.heights();
    this.dragHeight.set(Math.min(Math.max(state.startVisibleHeight - distance, peek), full));
  }

  protected endDrag(event: PointerEvent): void {
    const state = this.dragState;
    if (state?.pointerId !== event.pointerId) {
      return;
    }
    this.dragState = undefined;
    const dragHeight = this.dragHeight();
    this.dragHeight.set(null);
    if (!state.hasMoved || dragHeight === null) {
      return;
    }
    this.suppressesNextClick = true;
    this.moveTo(
      nearestSnapPosition({
        visibleHeight: dragHeight,
        velocity: state.velocity,
        heights: this.heights(),
      })
    );
  }

  protected cancelDrag(): void {
    this.dragState = undefined;
    this.dragHeight.set(null);
  }

  /** Keyboard and screen reader users must not land on content hidden below the screen. */
  protected revealFocusedContent(event: FocusEvent): void {
    if (
      this.isCompactViewport() &&
      this.snapPosition() === 'peek' &&
      event.target instanceof Node &&
      this.content().nativeElement.contains(event.target)
    ) {
      this.moveTo('half');
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
    this.sheetHeight.set(this.sheet().nativeElement.offsetHeight);
    // Handle and header stay visible at peek; the content starts right below them.
    this.peekHeight.set(this.content().nativeElement.offsetTop);
  }
}
