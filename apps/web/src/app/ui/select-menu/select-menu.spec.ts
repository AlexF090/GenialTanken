import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { textOf } from '../../../testing/render-page';
import { SelectMenu, targetIndexForKey } from './select-menu';
import type { SelectMenuOption } from './select-menu';

const SIZES: readonly SelectMenuOption<string>[] = [
  { value: 'small', label: 'Klein' },
  { value: 'medium', label: 'Mittel' },
  { value: 'large', label: 'Groß' },
];

@Component({
  imports: [SelectMenu],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-select-menu label="Größe" [options]="options" [(value)]="size">
      Größe: {{ size() }}
    </app-select-menu>
    <p>Außerhalb</p>
  `,
})
class SelectMenuHost {
  readonly options = SIZES;
  readonly size = signal('medium');
}

const render = async () => {
  const fixture = TestBed.createComponent(SelectMenuHost);
  document.body.append(fixture.nativeElement as HTMLElement);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const trigger = (): HTMLButtonElement => {
    const button = element.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]');
    if (button === null) {
      throw new Error('No menu button');
    }
    return button;
  };
  const menu = () => element.querySelector('[role="menu"]');
  const items = () => [...element.querySelectorAll<HTMLButtonElement>('[role="menuitemradio"]')];
  const item = (name: string): HTMLButtonElement => {
    const found = items().find(candidate => textOf(candidate) === name);
    if (found === undefined) {
      throw new Error(`No item named ${name}`);
    }
    return found;
  };
  const open = async () => {
    trigger().click();
    await fixture.whenStable();
  };
  const press = async (key: string) => {
    document.activeElement?.dispatchEvent(
      new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
    );
    await fixture.whenStable();
  };
  return {
    fixture,
    element,
    trigger,
    menu,
    items,
    item,
    open,
    press,
    host: fixture.componentInstance,
  };
};

/**
 * jsdom hides `[popover]:not(:popover-open)` in its default stylesheet, but implements neither
 * `showPopover()` nor `:popover-open` (jsdom/jsdom#3721), and since 30.1.2 it refuses to focus
 * elements hidden by `display: none`. Browsers either have both or neither, so this stands in for
 * the open state the menu reaches through `showPopover()` in a browser. `!important` is needed
 * because jsdom weighs its default stylesheet against author rules by specificity only.
 */
const showPopoversLikeABrowser = (): HTMLStyleElement => {
  const style = document.createElement('style');
  style.textContent = '[popover] { display: block !important; }';
  document.head.append(style);
  return style;
};

describe('SelectMenu', () => {
  let popoverStyle: HTMLStyleElement;

  beforeEach(() => {
    popoverStyle = showPopoversLikeABrowser();
  });

  afterEach(() => {
    popoverStyle.remove();
    document.body.replaceChildren();
  });

  it('shows the projected content on a collapsed menu button', async () => {
    const { trigger, menu } = await render();

    expect(textOf(trigger())).toBe('Größe: medium');
    expect(trigger().getAttribute('aria-expanded')).toBe('false');
    expect(trigger().hasAttribute('aria-controls')).toBe(false);
    expect(menu()).toBeNull();
  });

  it('opens a named menu with one checkable item per option', async () => {
    const { trigger, menu, items, item, open } = await render();

    await open();

    expect(trigger().getAttribute('aria-expanded')).toBe('true');
    expect(trigger().getAttribute('aria-controls')).toBe(menu()?.id);
    expect(menu()?.getAttribute('aria-label')).toBe('Größe');
    expect(items().map(candidate => textOf(candidate))).toEqual(['Klein', 'Mittel', 'Groß']);
    expect(item('Mittel').getAttribute('aria-checked')).toBe('true');
    expect(item('Klein').getAttribute('aria-checked')).toBe('false');
  });

  it('focuses the checked item when opened', async () => {
    const { item, open } = await render();

    await open();

    expect(document.activeElement).toBe(item('Mittel'));
  });

  it('applies the chosen option, closes and returns focus to the button', async () => {
    const { fixture, trigger, menu, item, open, host } = await render();
    await open();

    item('Groß').click();
    await fixture.whenStable();

    expect(host.size()).toBe('large');
    expect(menu()).toBeNull();
    expect(document.activeElement).toBe(trigger());
  });

  it('moves the focus with the arrow keys, Home and End', async () => {
    const { item, open, press } = await render();
    await open();

    await press('ArrowDown');
    expect(document.activeElement).toBe(item('Groß'));

    await press('ArrowDown');
    expect(document.activeElement).toBe(item('Klein'));

    await press('ArrowUp');
    expect(document.activeElement).toBe(item('Groß'));

    await press('Home');
    expect(document.activeElement).toBe(item('Klein'));

    await press('End');
    expect(document.activeElement).toBe(item('Groß'));
  });

  it('closes on Escape without changing the value', async () => {
    const { trigger, menu, open, press, host } = await render();
    await open();

    await press('ArrowDown');
    await press('Escape');

    expect(menu()).toBeNull();
    expect(host.size()).toBe('medium');
    expect(document.activeElement).toBe(trigger());
  });

  it('closes when the button is pressed again', async () => {
    const { menu, open } = await render();
    await open();

    await open();

    expect(menu()).toBeNull();
  });

  it('closes on a pointer down outside, but not inside the menu', async () => {
    const { fixture, element, menu, item, open } = await render();
    await open();

    item('Klein').dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(menu()).not.toBeNull();

    element.querySelector('p')?.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await fixture.whenStable();
    expect(menu()).toBeNull();
  });
});

describe('targetIndexForKey', () => {
  it('wraps the arrow keys around and ignores other keys', () => {
    expect(targetIndexForKey('ArrowDown', 2, 3)).toBe(0);
    expect(targetIndexForKey('ArrowUp', 0, 3)).toBe(2);
    expect(targetIndexForKey('ArrowUp', -1, 3)).toBe(2);
    expect(targetIndexForKey('ArrowDown', -1, 3)).toBe(0);
    expect(targetIndexForKey('Enter', 1, 3)).toBeUndefined();
    expect(targetIndexForKey('ArrowDown', -1, 0)).toBeUndefined();
  });
});
