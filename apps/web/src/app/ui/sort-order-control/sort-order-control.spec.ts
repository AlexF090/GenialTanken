import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import type { SortOrder } from '../../core/stations/sort-stations';
import { textOf } from '../../../testing/render-page';
import { SortOrderControl } from './sort-order-control';

@Component({
  imports: [SortOrderControl],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<app-sort-order-control [(sortOrder)]="sortOrder" />`,
})
class SortOrderControlHost {
  readonly sortOrder = signal<SortOrder>('distance');
}

const render = async () => {
  const fixture = TestBed.createComponent(SortOrderControlHost);
  await fixture.whenStable();
  const element = fixture.nativeElement as HTMLElement;
  const radio = (name: string): HTMLInputElement => {
    const label = [...element.querySelectorAll('label')].find(
      candidate => textOf(candidate) === name
    );
    const input = label?.querySelector('input');
    if (input === null || input === undefined) {
      throw new Error(`No radio named ${name}`);
    }
    return input;
  };
  return { fixture, element, radio, host: fixture.componentInstance };
};

describe('SortOrderControl', () => {
  it('is a group named "Sortierung" with one radio per order', async () => {
    const { element, radio } = await render();

    expect(textOf(element.querySelector('fieldset legend'))).toBe('Sortierung');
    expect(radio('Entfernung').type).toBe('radio');
    expect(radio('Preis').name).toBe(radio('Entfernung').name);
  });

  it('checks the current order', async () => {
    const { radio } = await render();

    expect(radio('Entfernung').checked).toBe(true);
    expect(radio('Preis').checked).toBe(false);
  });

  it('reports the chosen order and follows outside changes', async () => {
    const { fixture, radio, host } = await render();

    radio('Preis').click();
    await fixture.whenStable();

    expect(host.sortOrder()).toBe('price');

    host.sortOrder.set('distance');
    await fixture.whenStable();

    expect(radio('Entfernung').checked).toBe(true);
    expect(radio('Preis').checked).toBe(false);
  });
});
