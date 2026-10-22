import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { getButton, hostElementOf, textOf } from '../../../testing/render-page';
import { SheetDialog } from './sheet-dialog';

@Component({
  imports: [SheetDialog],
  template: `
    <button type="button">Öffnen</button>
    @if (isShown()) {
      <app-sheet-dialog title="Einstellungen" (closed)="closedCount = closedCount + 1">
        <p>Inhalt</p>
      </app-sheet-dialog>
    }
  `,
})
class DialogHost {
  readonly isShown = signal(true);
  closedCount = 0;
}

const render = async () => {
  const fixture = TestBed.createComponent(DialogHost);
  const element = hostElementOf(fixture);
  getButton(element, 'Öffnen').focus();
  await fixture.whenStable();
  const dialog = element.querySelector('dialog');
  if (dialog === null) {
    throw new Error('No dialog rendered');
  }
  return { fixture, element, dialog };
};

const pressEscape = (target: Element): void => {
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
};

describe('SheetDialog', () => {
  it('opens as a modal dialog named by its heading, with the content inside', async () => {
    const { dialog } = await render();

    expect(dialog.hasAttribute('open')).toBe(true);
    const heading = dialog.querySelector('h2');
    expect(textOf(heading)).toBe('Einstellungen');
    expect(dialog.getAttribute('aria-labelledby')).toBe(heading?.id);
    expect(textOf(dialog.querySelector('p'))).toBe('Inhalt');
    expect(dialog.querySelector('main, h1')).toBeNull();
  });

  it('moves the focus into the dialog', async () => {
    const { dialog } = await render();

    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement?.getAttribute('aria-label')).toBe('Schließen');
  });

  it('closes on Escape, reports it and returns the focus to the trigger', async () => {
    const { fixture, dialog } = await render();

    pressEscape(dialog);
    await fixture.whenStable();

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(fixture.componentInstance.closedCount).toBe(1);
    expect(textOf(document.activeElement)).toBe('Öffnen');
  });

  it('closes with its close button', async () => {
    const { fixture, dialog } = await render();

    getButton(dialog, 'Schließen').click();
    await fixture.whenStable();

    expect(dialog.hasAttribute('open')).toBe(false);
    expect(fixture.componentInstance.closedCount).toBe(1);
  });

  it('does not report a close when it is removed', async () => {
    const { fixture } = await render();

    fixture.componentInstance.isShown.set(false);
    await fixture.whenStable();

    expect(fixture.componentInstance.closedCount).toBe(0);
  });
});
