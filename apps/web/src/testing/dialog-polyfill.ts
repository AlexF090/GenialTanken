/**
 * jsdom has `<dialog>` without `showModal()` and `close()`. This stands in for the parts the app
 * relies on: the `open` state, focus on the first focusable descendant, Escape firing a
 * cancelable `cancel` and then `close`, and focus returning to the element focused before.
 * Neither the top layer nor inertness exists here; Playwright covers them in a real browser.
 */
const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

const previouslyFocusedElements = new WeakMap<HTMLDialogElement, Element | null>();

const closeDialog = (dialog: HTMLDialogElement): void => {
  if (!dialog.hasAttribute('open')) {
    return;
  }
  dialog.removeAttribute('open');
  const previouslyFocused = previouslyFocusedElements.get(dialog);
  previouslyFocusedElements.delete(dialog);
  if (previouslyFocused instanceof HTMLElement && previouslyFocused.isConnected) {
    previouslyFocused.focus();
  }
  dialog.dispatchEvent(new Event('close'));
};

const cancelOnEscape = (event: KeyboardEvent): void => {
  const dialog = event.currentTarget;
  if (event.key !== 'Escape' || !(dialog instanceof HTMLDialogElement)) {
    return;
  }
  if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) {
    closeDialog(dialog);
  }
};

export const installDialogPolyfill = (): void => {
  const prototype = HTMLDialogElement.prototype;
  if (typeof prototype.showModal === 'function') {
    return;
  }
  prototype.showModal = function (this: HTMLDialogElement): void {
    if (this.hasAttribute('open')) {
      return;
    }
    previouslyFocusedElements.set(this, document.activeElement);
    this.setAttribute('open', '');
    this.addEventListener('keydown', cancelOnEscape);
    this.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  };
  prototype.close = function (this: HTMLDialogElement): void {
    closeDialog(this);
  };
};
