/**
 * jsdom has `<dialog>` without `showModal()` and `close()`. This stands in for the parts the app
 * relies on, following the HTML standard where jsdom allows it:
 *
 * - `showModal()` throws an `InvalidStateError` for a disconnected dialog or an open non-modal
 *   one, and moves the focus like the dialog focusing steps: the dialog itself with `autofocus`,
 *   else its first descendant with `autofocus`, else its first focusable descendant.
 * - Escape pressed anywhere in the document is a close request for the topmost modal dialog,
 *   unless a handler prevented the default: a cancelable `cancel`, then the close. Unlike in a
 *   browser, the dialog stays open until the next task.
 * - `close()` returns the focus to the element focused before `showModal()` and fires `close` in
 *   a task of its own, as browsers do, never synchronously.
 *
 * Neither the top layer nor inertness exists here; Playwright covers them, and that the focus
 * really returns, in a real browser.
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Taken at installation, before a test can fake timers: the browser's task queue is real. */
const queueTask = globalThis.setTimeout;

const previouslyFocusedElements = new WeakMap<HTMLDialogElement, Element | null>();
/** Open modal dialogs, the topmost last. */
const modalDialogs: HTMLDialogElement[] = [];

const focusTargetOf = (dialog: HTMLDialogElement): HTMLElement =>
  dialog.hasAttribute('autofocus')
    ? dialog
    : (dialog.querySelector<HTMLElement>('[autofocus]') ??
      dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ??
      dialog);

const closeDialog = (dialog: HTMLDialogElement, closeEvent: 'queued' | 'now'): void => {
  if (!dialog.hasAttribute('open')) {
    return;
  }
  dialog.removeAttribute('open');
  const index = modalDialogs.indexOf(dialog);
  if (index !== -1) {
    modalDialogs.splice(index, 1);
  }
  const previouslyFocused = previouslyFocusedElements.get(dialog);
  previouslyFocusedElements.delete(dialog);
  if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
    previouslyFocused.focus();
  }
  const fireClose = (): void => {
    dialog.dispatchEvent(new Event('close'));
  };
  if (closeEvent === 'now') {
    fireClose();
  } else {
    queueTask(fireClose);
  }
};

/** A dialog removed from the document leaves the top layer without a `close` event. */
const topmostModalDialog = (): HTMLDialogElement | undefined => {
  for (const dialog of [...modalDialogs]) {
    if (!dialog.isConnected) {
      modalDialogs.splice(modalDialogs.indexOf(dialog), 1);
    }
  }
  return modalDialogs.at(-1);
};

const requestCloseOnEscape = (event: KeyboardEvent): void => {
  if (event.key !== 'Escape' || topmostModalDialog() === undefined) {
    return;
  }
  // Listens while capturing, so it sees the key wherever it was pressed, even without bubbling.
  // It decides in a task, once every handler had its chance to prevent the default, and closes
  // in that task, so the `close` event still comes in a task of its own.
  queueTask(() => {
    const dialog = topmostModalDialog();
    if (event.defaultPrevented || dialog === undefined) {
      return;
    }
    if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) {
      closeDialog(dialog, 'now');
    }
  });
};

export const installDialogPolyfill = (): void => {
  const prototype = HTMLDialogElement.prototype;
  if (typeof prototype.showModal === 'function') {
    return;
  }
  document.addEventListener('keydown', requestCloseOnEscape, { capture: true });
  prototype.showModal = function (this: HTMLDialogElement): void {
    if (this.hasAttribute('open')) {
      if (modalDialogs.includes(this)) {
        return;
      }
      throw new DOMException(
        'The dialog is already open as a non-modal dialog.',
        'InvalidStateError'
      );
    }
    if (!this.isConnected) {
      throw new DOMException('The dialog is not in a document.', 'InvalidStateError');
    }
    previouslyFocusedElements.set(this, document.activeElement);
    this.setAttribute('open', '');
    modalDialogs.push(this);
    focusTargetOf(this).focus();
  };
  prototype.close = function (this: HTMLDialogElement): void {
    closeDialog(this, 'queued');
  };
};
