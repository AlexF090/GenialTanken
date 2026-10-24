import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { getButton, hostElementOf, textOf } from '../../../testing/render-page';
import type { LabeledOption } from '../../core/labeled-option';
import { FilterChip } from './filter-chip';

const SIZES: readonly LabeledOption<string>[] = [
  { value: 'small', label: 'Klein' },
  { value: 'large', label: 'Groß' },
];

@Component({
  imports: [FilterChip],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-filter-chip
      label="Größe"
      [options]="options"
      [value]="size()"
      [face]="size() === 'small' ? 'Klein' : 'Groß'"
      (valueChange)="size.set($event)" />
  `,
})
class FilterChipHost {
  readonly options = SIZES;
  readonly size = signal('small');
}

const render = async () => {
  const fixture = TestBed.createComponent(FilterChipHost);
  document.body.append(hostElementOf(fixture));
  await fixture.whenStable();
  return { fixture, element: hostElementOf(fixture), host: fixture.componentInstance };
};

describe('FilterChip', () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it('shows the current choice and names the filter for assistive technology', async () => {
    const { element } = await render();

    const chip = getButton(element, 'Größe: Klein');
    expect(chip.getAttribute('aria-haspopup')).toBe('menu');
    expect(textOf(chip.querySelector('.visually-hidden'))).toBe('Größe:');
  });

  it('opens a menu named after the filter and applies the chosen option', async () => {
    const { element, fixture, host } = await render();

    getButton(element, 'Größe: Klein').click();
    await fixture.whenStable();
    const menu = element.querySelector('[role="menu"][aria-label="Größe"]');
    expect(
      [...(menu?.querySelectorAll('[role="menuitemradio"]') ?? [])].map(item => textOf(item))
    ).toEqual(['Klein', 'Groß']);

    getButton(element, 'Groß').click();
    await fixture.whenStable();

    expect(host.size()).toBe('large');
    expect(getButton(element, 'Größe: Groß')).toBeDefined();
  });
});
