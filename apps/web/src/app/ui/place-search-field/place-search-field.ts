import type { ElementRef, TemplateRef } from '@angular/core';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  linkedSignal,
  model,
  output,
  signal,
  viewChild,
} from '@angular/core';
import type { Place } from '@genialtanken/contracts';
import { Icon } from '../icon/icon';
import { pluralize } from '../../core/formatting/pluralize';
import { uniqueIdentifier } from '../../core/dom/unique-identifier';

/**
 * Search field like the search bar of Apple Maps (combobox with a listbox, ARIA 1.2 pattern).
 * The host renders the suggestions where there is room for them, through `suggestionsTemplate`
 * and `NgTemplateOutlet`, e.g. in the sheet above the on-screen keyboard instead of a popover
 * the keyboard would cover. Render them at all times, so `aria-controls` always points to the
 * listbox; it is hidden while closed.
 */
@Component({
  selector: 'app-place-search-field',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './place-search-field.html',
  styleUrl: './place-search-field.scss',
})
export class PlaceSearchField {
  readonly query = model.required<string>();
  readonly placeholder = input.required<string>();
  readonly suggestions = input.required<readonly Place[]>();
  /** Shown in place of suggestions, e.g. that nothing matched or the search failed. */
  readonly statusMessage = input<string>();
  /** Shown in place of the suggestions while there are none, e.g. what can be searched. */
  readonly hint = input<string>();
  /** Shows "Abbrechen" next to the field, which leaves the search like Escape does. */
  readonly isCancelable = input(false);

  readonly searchStarted = output();
  readonly canceled = output();

  readonly placeSelected = output<Place>();
  readonly cleared = output();

  private readonly inputElement = viewChild.required<ElementRef<HTMLInputElement>>('input');
  readonly suggestionsTemplate = viewChild.required<TemplateRef<unknown>>('suggestionList');

  protected readonly identifier = uniqueIdentifier('place-search');
  protected readonly listboxIdentifier = `${this.identifier}-listbox`;
  private readonly isListRequested = signal(false);
  protected readonly isListOpen = computed(
    () =>
      this.isListRequested() &&
      (this.suggestions().length > 0 || this.statusMessage() !== undefined)
  );
  /** Index of the suggestion highlighted with the arrow keys; reset when the suggestions change. */
  protected readonly activeIndex = linkedSignal<readonly Place[], number>({
    source: this.suggestions,
    computation: () => -1,
  });
  protected readonly activeOptionIdentifier = computed(() =>
    this.isListOpen() && this.activeIndex() >= 0 ? this.optionIdentifier(this.activeIndex()) : null
  );

  protected readonly announcement = computed(() => {
    if (!this.isListOpen()) {
      return '';
    }
    const count = this.suggestions().length;
    if (count === 0) {
      return this.statusMessage() ?? '';
    }
    return `${String(count)} ${pluralize(count, 'Ort', 'Orte')} gefunden`;
  });

  protected optionIdentifier(index: number): string {
    return `${this.identifier}-option-${String(index)}`;
  }

  protected handleInput(value: string): void {
    this.query.set(value);
    this.isListRequested.set(true);
  }

  protected handleKeydown(event: KeyboardEvent): void {
    const suggestionCount = this.suggestions().length;
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowUp': {
        if (suggestionCount === 0) {
          return;
        }
        event.preventDefault();
        if (!this.isListOpen()) {
          this.isListRequested.set(true);
        }
        const step = event.key === 'ArrowDown' ? 1 : -1;
        this.activeIndex.update(index => (index + step + suggestionCount) % suggestionCount);
        return;
      }
      case 'Enter': {
        const activePlace = this.isListOpen() ? this.suggestions()[this.activeIndex()] : undefined;
        if (activePlace !== undefined) {
          event.preventDefault();
          this.select(activePlace);
        }
        return;
      }
      case 'Escape':
        if (this.isCancelable()) {
          event.preventDefault();
          this.cancel();
          return;
        }
        if (this.isListOpen()) {
          event.preventDefault();
          this.isListRequested.set(false);
        }
        return;
      default:
        return;
    }
  }

  protected closeList(): void {
    this.isListRequested.set(false);
  }

  /** Keeps the focus in the field while a suggestion is pressed, so blur does not close the list. */
  protected keepFocus(event: Event): void {
    event.preventDefault();
  }

  protected select(place: Place): void {
    this.isListRequested.set(false);
    this.placeSelected.emit(place);
    // Like on iOS: choosing a result dismisses the keyboard.
    this.inputElement().nativeElement.blur();
  }

  protected cancel(): void {
    this.isListRequested.set(false);
    this.inputElement().nativeElement.blur();
    this.canceled.emit();
  }

  protected clear(): void {
    this.query.set('');
    this.isListRequested.set(false);
    this.cleared.emit();
    this.inputElement().nativeElement.focus();
  }
}
