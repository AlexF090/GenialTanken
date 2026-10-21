import type { ElementRef } from '@angular/core';
import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  input,
  model,
  signal,
  viewChild,
  viewChildren,
} from '@angular/core';
import { Icon } from '../icon/icon';

export interface SelectMenuOption<T> {
  value: T;
  label: string;
}

let nextIdentifier = 0;

/**
 * Button that opens a menu of mutually exclusive options, like a pull-down menu on iOS: the
 * current option carries a checkmark and choosing one applies it at once. The projected content
 * is the visible face of the button; `label` names the menu for assistive technology.
 *
 * The menu is shown in the top layer (Popover API) where supported, so the clipping of scroll
 * containers such as the bottom sheet does not cut it off. Dismissal is handled here instead of
 * by `popover="auto"`, so it behaves the same in every browser.
 */
@Component({
  selector: 'app-select-menu',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './select-menu.html',
  styleUrl: './select-menu.scss',
  host: {
    '(document:pointerdown)': 'closeOnOutsidePointer($event)',
  },
})
export class SelectMenu<T> {
  readonly options = input.required<readonly SelectMenuOption<T>[]>();
  readonly value = model.required<T>();
  readonly label = input.required<string>();

  private readonly trigger = viewChild.required<ElementRef<HTMLElement>>('trigger');
  private readonly menu = viewChild<ElementRef<HTMLElement>>('menu');
  private readonly items = viewChildren<ElementRef<HTMLButtonElement>>('item');

  protected readonly isOpen = signal(false);
  protected readonly menuIdentifier = `select-menu-${String(nextIdentifier)}`;
  protected readonly anchorName = `--select-menu-${String(nextIdentifier++)}`;

  constructor() {
    afterRenderEffect(() => {
      const menu = this.menu()?.nativeElement;
      if (!this.isOpen() || menu === undefined) {
        return;
      }
      showInTopLayer(menu);
      const checkedIndex = this.options().findIndex(option => option.value === this.value());
      this.focusItem(Math.max(checkedIndex, 0));
    });
  }

  protected toggle(): void {
    this.isOpen.update(isOpen => !isOpen);
  }

  protected choose(option: SelectMenuOption<T>): void {
    this.value.set(option.value);
    this.close();
  }

  protected handleMenuKeydown(event: KeyboardEvent): void {
    const itemCount = this.items().length;
    const currentIndex = this.items().findIndex(
      item => item.nativeElement === document.activeElement
    );
    const targetIndex = targetIndexForKey(event.key, currentIndex, itemCount);
    if (targetIndex !== undefined) {
      event.preventDefault();
      this.focusItem(targetIndex);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      this.close();
      return;
    }
    // Focus goes back to the button first, so the browser moves on from there.
    if (event.key === 'Tab') {
      this.close();
    }
  }

  protected closeOnOutsidePointer(event: PointerEvent): void {
    if (!this.isOpen()) {
      return;
    }
    const host = this.trigger().nativeElement.parentElement;
    if (event.target instanceof Node && host?.contains(event.target) === true) {
      return;
    }
    this.close({ restoreFocus: false });
  }

  private close({ restoreFocus = true }: { restoreFocus?: boolean } = {}): void {
    this.isOpen.set(false);
    if (restoreFocus) {
      this.trigger().nativeElement.focus();
    }
  }

  private focusItem(index: number): void {
    this.items()[index]?.nativeElement.focus();
  }
}

const showInTopLayer = (element: HTMLElement): void => {
  if (typeof element.showPopover === 'function' && !element.matches(':popover-open')) {
    element.showPopover();
  }
};

/** Roving focus inside the menu: arrows wrap around, Home and End jump to the ends. */
export const targetIndexForKey = (
  key: string,
  currentIndex: number,
  itemCount: number
): number | undefined => {
  if (itemCount === 0) {
    return undefined;
  }
  switch (key) {
    case 'ArrowDown':
      return (currentIndex + 1) % itemCount;
    case 'ArrowUp':
      return currentIndex <= 0 ? itemCount - 1 : currentIndex - 1;
    case 'Home':
      return 0;
    case 'End':
      return itemCount - 1;
    default:
      return undefined;
  }
};
