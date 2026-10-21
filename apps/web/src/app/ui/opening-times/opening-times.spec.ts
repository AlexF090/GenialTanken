import { TestBed } from '@angular/core/testing';
import type { OpeningTimes as StationOpeningTimes } from '@genialtanken/contracts';
import { textOf } from '../../../testing/render-page';
import { OpeningTimes } from './opening-times';

const OPENING_TIMES: StationOpeningTimes = {
  monday: [{ opening: '05:00', closing: '23:00' }],
  tuesday: [{ opening: '05:00', closing: '23:00' }],
  wednesday: [{ opening: '05:00', closing: '23:00' }],
  thursday: [{ opening: '05:00', closing: '23:00' }],
  friday: [{ opening: '05:00', closing: '23:00' }],
  saturday: [
    { opening: '07:00', closing: '12:00' },
    { opening: '14:00', closing: '20:00' },
  ],
  sunday: [],
  publicHoliday: [],
};

const render = async (today: Date) => {
  const fixture = TestBed.createComponent(OpeningTimes);
  fixture.componentRef.setInput('openingTimes', OPENING_TIMES);
  fixture.componentRef.setInput('today', today);
  await fixture.whenStable();
  return [...(fixture.nativeElement as HTMLElement).querySelectorAll('li')];
};

describe('OpeningTimes', () => {
  it('lists every day in order with its hours', async () => {
    const days = await render(new Date('2026-10-05T12:00:00'));

    expect(days.map(day => textOf(day))).toEqual([
      'Montag: 05:00 - 23:00',
      'Dienstag: 05:00 - 23:00',
      'Mittwoch: 05:00 - 23:00',
      'Donnerstag: 05:00 - 23:00',
      'Freitag: 05:00 - 23:00',
      'Samstag: 07:00 - 12:00, 14:00 - 20:00',
      'Sonntag: keine Angabe',
      'Feiertag: keine Angabe',
    ]);
  });

  it('marks only today as the current date', async () => {
    const days = await render(new Date('2026-10-10T12:00:00'));

    const currentDays = days.filter(day => day.getAttribute('aria-current') === 'date');
    expect(currentDays.map(day => textOf(day))).toEqual(['Samstag: 07:00 - 12:00, 14:00 - 20:00']);
  });
});
