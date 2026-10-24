const nextTask = (): Promise<void> =>
  new Promise(resolve => {
    setTimeout(resolve, 0);
  });

/** The stand-in for `<dialog>` (installed by `global-test-setup.ts`) behaves like a browser's. */
describe('dialog polyfill', () => {
  const render = (html: string): HTMLDialogElement => {
    document.body.innerHTML = `<button id="trigger">Öffnen</button>${html}`;
    document.querySelector<HTMLElement>('#trigger')?.focus();
    const dialog = document.querySelector('dialog');
    if (dialog === null) {
      throw new Error('No dialog rendered');
    }
    return dialog;
  };

  const closeEventOf = (dialog: HTMLDialogElement): Promise<void> =>
    new Promise(resolve => {
      dialog.addEventListener('close', () => {
        resolve();
      });
    });

  afterEach(() => {
    for (const dialog of document.querySelectorAll('dialog')) {
      dialog.close();
    }
    document.body.replaceChildren();
  });

  it('focuses the first focusable descendant', () => {
    const dialog = render(
      '<dialog><p>Text</p><button>Erster</button><button>Zweiter</button></dialog>'
    );

    dialog.showModal();

    expect(dialog.open).toBe(true);
    expect(document.activeElement?.textContent).toBe('Erster');
  });

  it('focuses the descendant with autofocus first', () => {
    const dialog = render(
      '<dialog><button>Erster</button><input autofocus aria-label="Feld" /></dialog>'
    );

    dialog.showModal();

    expect(document.activeElement?.getAttribute('aria-label')).toBe('Feld');
  });

  it('refuses to open a dialog outside the document', () => {
    const dialog = document.createElement('dialog');

    expect(() => {
      dialog.showModal();
    }).toThrow(expect.objectContaining({ name: 'InvalidStateError' }));
  });

  it('fires close in a task of its own and returns the focus', async () => {
    const dialog = render('<dialog><button>Schließen</button></dialog>');
    dialog.showModal();
    const closed = vi.fn();
    dialog.addEventListener('close', closed);
    const closeEvent = closeEventOf(dialog);

    dialog.close();

    expect(dialog.open).toBe(false);
    expect(closed).not.toHaveBeenCalled();
    expect(document.activeElement?.id).toBe('trigger');
    await closeEvent;
    expect(closed).toHaveBeenCalledOnce();
  });

  it('closes on Escape pressed anywhere, with a cancel event first', async () => {
    const dialog = render('<dialog><button>Schließen</button></dialog>');
    dialog.showModal();
    const canceled = vi.fn();
    dialog.addEventListener('cancel', canceled);
    const closeEvent = closeEventOf(dialog);

    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await closeEvent;

    expect(canceled).toHaveBeenCalledOnce();
    expect(dialog.open).toBe(false);
  });

  it('stays open when the cancel event or the key press is canceled', async () => {
    const dialog = render('<dialog><button>Schließen</button></dialog>');
    dialog.showModal();
    const button = dialog.querySelector('button');
    button?.addEventListener('keydown', event => {
      event.preventDefault();
    });

    button?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    );
    await nextTask();
    expect(dialog.open).toBe(true);

    dialog.addEventListener('cancel', event => {
      event.preventDefault();
    });
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await nextTask();
    expect(dialog.open).toBe(true);
  });
});
