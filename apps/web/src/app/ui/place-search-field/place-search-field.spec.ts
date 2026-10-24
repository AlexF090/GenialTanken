import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { Place } from '@genialtanken/contracts';
import { bastillePlace, lyonPlace } from '../../../testing/place-fixtures';
import { getButton, hostElementOf, textOf } from '../../../testing/render-page';
import { PlaceSearchField } from './place-search-field';

@Component({
  imports: [NgTemplateOutlet, PlaceSearchField],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-place-search-field
      #field
      placeholder="Position auf Karte"
      hint="Ort oder Adresse eingeben."
      [(query)]="query"
      [suggestions]="suggestions()"
      [statusMessage]="statusMessage()"
      [isCancelable]="isCancelable()"
      (searchStarted)="startCount = startCount + 1"
      (canceled)="cancelCount = cancelCount + 1"
      (placeSelected)="selectedPlaces.push($event)"
      (cleared)="clearCount = clearCount + 1" />
    <section aria-label="Ergebnisse">
      <ng-container [ngTemplateOutlet]="field.suggestionsTemplate()" />
    </section>
  `,
})
class PlaceSearchFieldHost {
  readonly query = signal('');
  readonly suggestions = signal<readonly Place[]>([]);
  readonly statusMessage = signal<string | undefined>(undefined);
  readonly isCancelable = signal(false);
  readonly selectedPlaces: Place[] = [];
  clearCount = 0;
  startCount = 0;
  cancelCount = 0;
}

const render = async () => {
  const fixture = TestBed.createComponent(PlaceSearchFieldHost);
  document.body.append(hostElementOf(fixture));
  await fixture.whenStable();
  const element = hostElementOf(fixture);
  const combobox = (): HTMLInputElement => {
    const input = element.querySelector<HTMLInputElement>('input[role="combobox"]');
    if (input === null) {
      throw new Error('No combobox');
    }
    return input;
  };
  const options = () => [...element.querySelectorAll<HTMLElement>('[role="option"]')];
  const listbox = () => element.querySelector('[role="listbox"]');
  const isListShown = () => listbox()?.hasAttribute('hidden') === false;
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

  it('is a named search combobox with the placeholder', async () => {
    const { element, combobox } = await render();

    expect(element.querySelector('[role="search"]')).not.toBeNull();
    expect(combobox().getAttribute('aria-label')).toBe('Ort suchen');
    expect(combobox().placeholder).toBe('Position auf Karte');
    expect(combobox().getAttribute('aria-expanded')).toBe('false');
  });

  it('renders the hidden listbox where the host puts the suggestions', async () => {
    const { element, combobox, listbox, isListShown } = await render();

    expect(listbox()?.closest('section[aria-label="Ergebnisse"]')).not.toBeNull();
    expect(listbox()?.closest('[role="search"]')).toBeNull();
    expect(combobox().getAttribute('aria-controls')).toBe(listbox()?.id);
    expect(isListShown()).toBe(false);
    expect(textOf(element.querySelector('.place-search-field__hint'))).toBe(
      'Ort oder Adresse eingeben.'
    );
  });

  it('reports the start of a search when the field is focused', async () => {
    const { fixture, combobox, host } = await render();

    combobox().focus();
    await fixture.whenStable();

    expect(host.startCount).toBe(1);
  });

  it('reports typed text and lists the suggestions with name and description', async () => {
    const { fixture, combobox, options, isListShown, type, host } = await render();

    await type('Bast');
    expect(host.query()).toBe('Bast');
    expect(isListShown()).toBe(false);

    host.suggestions.set([bastillePlace, lyonPlace]);
    await fixture.whenStable();

    expect(isListShown()).toBe(true);
    expect(combobox().getAttribute('aria-expanded')).toBe('true');
    expect(options().map(option => textOf(option))).toEqual([
      'Place de la Bastille, 75011 Paris, Frankreich',
      'Lyon, Auvergne-Rhône-Alpes, Frankreich',
    ]);
  });

  it('announces the number of suggestions', async () => {
    const { fixture, element, type, host } = await render();
    await type('Bast');

    host.suggestions.set([bastillePlace, lyonPlace]);
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
    host.suggestions.set([bastillePlace, lyonPlace]);
    await fixture.whenStable();

    await press('ArrowDown');
    expect(combobox().getAttribute('aria-activedescendant')).toBe(options()[0]?.id);
    expect(options()[0]?.getAttribute('aria-selected')).toBe('true');

    await press('ArrowDown');
    await press('ArrowDown');
    expect(combobox().getAttribute('aria-activedescendant')).toBe(options()[0]?.id);

    await press('ArrowUp');
    await press('Enter');

    expect(host.selectedPlaces).toEqual([lyonPlace]);
    expect(isListShown()).toBe(false);
    expect(document.activeElement).toBe(combobox());
  });

  it('chooses a suggestion by click', async () => {
    const { fixture, options, type, host } = await render();
    await type('Bast');
    host.suggestions.set([bastillePlace]);
    await fixture.whenStable();

    options()[0]?.click();

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

  it('offers "Abbrechen" only when cancelable and reports it', async () => {
    const { element, fixture, isListShown, type, host } = await render();
    expect(element.querySelector('.place-search-field__cancel')).toBeNull();
    host.isCancelable.set(true);
    await type('Bast');
    host.suggestions.set([bastillePlace]);
    await fixture.whenStable();

    getButton(element, 'Abbrechen').click();
    await fixture.whenStable();

    expect(host.cancelCount).toBe(1);
    expect(isListShown()).toBe(false);
  });

  it('cancels with Escape when cancelable, even with the suggestions open', async () => {
    const { fixture, combobox, isListShown, type, press, host } = await render();
    host.isCancelable.set(true);
    await type('Bast');
    host.suggestions.set([bastillePlace]);
    await fixture.whenStable();

    await press('Escape');

    expect(host.cancelCount).toBe(1);
    expect(isListShown()).toBe(false);
    expect(document.activeElement).toBe(combobox());
  });

  it('keeps the suggestions when leaving the field while cancelable', async () => {
    const { fixture, combobox, isListShown, type, host } = await render();
    host.isCancelable.set(true);
    await type('Bast');
    host.suggestions.set([bastillePlace]);
    await fixture.whenStable();

    combobox().blur();
    await fixture.whenStable();

    expect(isListShown()).toBe(true);
  });
});
