import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Place } from '@genialtanken/contracts';
import { bastillePlace, kasselPlace } from '../../../testing/place-fixtures';
import { getButton, textOf } from '../../../testing/render-page';
import { PlaceSearchField } from './place-search-field';

@Component({
  imports: [PlaceSearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-place-search-field
      placeholder="Position auf Karte"
      [(query)]="query"
      [suggestions]="suggestions()"
      [statusMessage]="statusMessage()"
      (placeSelected)="selectedPlaces.push($event)"
      (cleared)="clearCount = clearCount + 1">
      <button type="button" placeSearchAccessory>5 km</button>
    </app-place-search-field>
  `,
})
class PlaceSearchFieldHost {
  readonly query = signal('');
  readonly suggestions = signal<readonly Place[]>([]);
  readonly statusMessage = signal<string | undefined>(undefined);
  readonly selectedPlaces: Place[] = [];
  clearCount = 0;
}

const render = async () => {
  const fixture = TestBed.createComponent(PlaceSearchFieldHost);
  document.body.append(fixture.nativeElement as HTMLElement);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const combobox = (): HTMLInputElement => {
    const input = element.querySelector<HTMLInputElement>('input[role="combobox"]');
    if (input === null) {
      throw new Error('No combobox');
    }
    return input;
  };
  const options = () => [...element.querySelectorAll('[role="option"]')];
  const listbox = () => element.querySelector('[role="listbox"]');
  const isListShown = () => listbox()?.parentElement?.hidden === false;
  const type = async (value: string) => {
    combobox().focus();
    combobox().value = value;
    combobox().dispatchEvent(new Event('input'));
    await fixture.whenStable();
  };
  const press = async (key: string) => {
    combobox().dispatchEvent(new KeyboardEvent('keydown', { key, cancelable: true }));
    await fixture.whenStable();
  };
  return {
    fixture,
    element,
    combobox,
    options,
    listbox,
    isListShown,
    type,
    press,
    host: fixture.componentInstance,
  };
};

describe('PlaceSearchField', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('is a named search combobox with the placeholder and the accessory', async () => {
    const { element, combobox } = await render();

    expect(element.querySelector('[role="search"]')).not.toBeNull();
    expect(combobox().getAttribute('aria-label')).toBe('Ort suchen');
    expect(combobox().placeholder).toBe('Position auf Karte');
    expect(combobox().getAttribute('aria-expanded')).toBe('false');
    expect(getButton(element, '5 km')).toBeDefined();
  });

  it('reports typed text and lists the suggestions with name and description', async () => {
    const { fixture, combobox, options, isListShown, type, host } = await render();

    await type('Bast');
    expect(host.query()).toBe('Bast');
    expect(isListShown()).toBe(false);

    host.suggestions.set([bastillePlace, kasselPlace]);
    await fixture.whenStable();

    expect(isListShown()).toBe(true);
    expect(combobox().getAttribute('aria-expanded')).toBe('true');
    expect(options().map(option => textOf(option))).toEqual([
      'Place de la Bastille, 75011 Paris, Frankreich',
      'Kassel, Hessen, Deutschland',
    ]);
  });

  it('announces the number of suggestions', async () => {
    const { fixture, element, type, host } = await render();
    await type('Bast');

    host.suggestions.set([bastillePlace, kasselPlace]);
    await fixture.whenStable();

    expect(textOf(element.querySelector('[role="status"]'))).toBe('2 Orte gefunden');
  });

  it('shows the status message when nothing matched', async () => {
    const { fixture, element, isListShown, type, host } = await render();
    await type('Xyzzy');

    host.statusMessage.set('Keine passenden Orte gefunden.');
    await fixture.whenStable();

    expect(isListShown()).toBe(true);
    expect(textOf(element.querySelector('.place-search-field__status'))).toBe(
      'Keine passenden Orte gefunden.'
    );
  });

  it('highlights suggestions with the arrow keys and chooses one with Enter', async () => {
    const { fixture, combobox, options, isListShown, type, press, host } = await render();
    await type('Bast');
    host.suggestions.set([bastillePlace, kasselPlace]);
    await fixture.whenStable();

    await press('ArrowDown');
    expect(combobox().getAttribute('aria-activedescendant')).toBe(options()[0]?.id);
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');

    await press('ArrowDown');
    await press('ArrowDown');
    expect(combobox().getAttribute('aria-activedescendant')).toBe(options()[0]?.id);

    await press('ArrowUp');
    await press('Enter');

    expect(host.selectedPlaces).toEqual([kasselPlace]);
    expect(isListShown()).toBe(false);
    expect(document.activeElement).not.toBe(combobox());
  });

  it('chooses a suggestion by click', async () => {
    const { fixture, options, type, host } = await render();
    await type('Bast');
    host.suggestions.set([bastillePlace]);
    await fixture.whenStable();

    (options()[0] as HTMLElement).click();

    expect(host.selectedPlaces).toEqual([bastillePlace]);
  });

  it('closes the suggestions on Escape and when leaving the field', async () => {
    const { fixture, combobox, isListShown, type, press, host } = await render();
    await type('Bast');
    host.suggestions.set([bastillePlace]);
    await fixture.whenStable();

    await press('Escape');
    expect(isListShown()).toBe(false);

    await type('Basti');
    expect(isListShown()).toBe(true);
    combobox().blur();
    await fixture.whenStable();
    expect(isListShown()).toBe(false);
  });

  it('clears the text with the clear button and reports it', async () => {
    const { element, fixture, combobox, type, host } = await render();
    expect(element.querySelector('button[aria-label="Suche löschen"]')).toBeNull();
    await type('Bast');

    getButton(element, 'Suche löschen').click();
    await fixture.whenStable();

    expect(host.query()).toBe('');
    expect(combobox().value).toBe('');
    expect(host.clearCount).toBe(1);
    expect(document.activeElement).toBe(combobox());
  });
});
