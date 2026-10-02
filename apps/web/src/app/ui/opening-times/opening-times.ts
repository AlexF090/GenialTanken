import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OpeningTimes as StationOpeningTimes } from '@genialtanken/contracts';

const DAY_LABELS: Record<keyof StationOpeningTimes, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
  publicHoliday: 'Feiertag',
};

const DAYS_IN_DISPLAY_ORDER: readonly (keyof StationOpeningTimes)[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
  'publicHoliday',
];

interface OpeningDay {
  day: keyof StationOpeningTimes;
  label: string;
  hours: string;
}

@Component({
  selector: 'app-opening-times',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="opening-times" role="list">
      @for (openingDay of openingDays(); track openingDay.day) {
        <li class="opening-times__day">{{ openingDay.label }}: {{ openingDay.hours }}</li>
      }
    </ul>
  `,
  styles: `
    .opening-times {
      list-style: none;
    }

    .opening-times__day {
      padding: var(--space-2xs) 0;
      border-top: var(--border-width-thin) solid var(--color-divider);
      font-size: var(--font-size-sm);
    }
  `,
})
export class OpeningTimes {
  readonly openingTimes = input.required<StationOpeningTimes>();

  protected readonly openingDays = computed<OpeningDay[]>(() =>
    DAYS_IN_DISPLAY_ORDER.map(day => {
      const intervals = this.openingTimes()[day];
      return {
        day,
        label: DAY_LABELS[day],
        hours:
          intervals.length === 0
            ? 'keine Angabe'
            : intervals.map(interval => `${interval.opening} - ${interval.closing}`).join(', '),
      };
    })
  );
}
