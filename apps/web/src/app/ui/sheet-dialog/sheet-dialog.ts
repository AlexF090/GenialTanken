import type { ElementRef } from '@angular/core';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';
import { Icon } from '../icon/icon';

/**
 * Modal page sheet around the native `<dialog>`, opened with `showModal()` as soon as it renders:
 * the browser keeps the focus inside, makes everything behind it inert, shows it in the top
 * layer and closes it on Escape. On phones it slides up from the bottom like an iOS page sheet,
 * from 48rem it is a centered card. Its heading names it.
 *
 * Content marked `sheetDialogFooter` stays below the scrolling content, e.g. an app-wide notice:
 * the modal dialog makes everything outside it inert.
 *
 * `closed` fires once the dialog closes (✕ or Escape); the browser then returns the focus to the
 * element focused before it opened. Removing the component does not emit.
 */
@Component({
  selector: 'app-sheet-dialog',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sheet-dialog.html',
  styleUrl: './sheet-dialog.scss',
})
export class SheetDialog {
  readonly title = input.required<string>();
  readonly closed = output();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');
  protected readonly titleIdentifier = uniqueIdentifier('sheet-dialog-title');
  private isDestroyed = false;

  constructor() {
    afterNextRender(() => {
      this.dialog().nativeElement.showModal();
    });
    inject(DestroyRef).onDestroy(() => {
      this.isDestroyed = true;
    });
  }

  close(): void {
    this.dialog().nativeElement.close();
  }

  protected announceClosed(): void {
    if (!this.isDestroyed) {
      this.closed.emit();
    }
  }
}
