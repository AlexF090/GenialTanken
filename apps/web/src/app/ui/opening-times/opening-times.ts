import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OpeningTimes as StationOpeningTimes } from '@genialtanken/contracts';
import { weekdayOf } from '../../core/time/weekday-of';

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
  isToday: boolean;
}

/** Day and hours in two aligned columns; reads "Montag: 05:00 - 23:00" per day. */
@Component({
  selector: 'app-opening-times',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <ul class="opening-times" role="list">
      @for (openingDay of openingDays(); track openingDay.day) {
        <li
          class="opening-times__day"
          [class.opening-times__day--today]="openingDay.isToday"
          [attr.aria-current]="openingDay.isToday ? 'date' : null">
          <span>{{ openingDay.label }}<span class="visually-hidden">:</span></span
          >&ngsp;<span>{{ openingDay.hours }}</span>
        </li>
      }
    </ul>
  `,
  styles: `
    .opening-times {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      list-style: none;
    }

    .opening-times__day {
      position: relative;
      display: grid;
      grid-column: 1 / -1;
      grid-template-columns: subgrid;
      column-gap: var(--space-xl);
      padding: var(--space-xs) var(--space-sm);
      border-bottom: var(--border-width-hairline) solid var(--color-hairline);
      color: var(--color-text-secondary);
      font-variant-numeric: tabular-nums;

      // The public holiday row follows Sunday but is not a weekday
      &:last-child {
        margin-top: var(--space-xs);
        border-top: var(--border-width-hairline) solid var(--color-hairline);
      }

      // Today: bolder text and the marker bar of the selected station row, no extra color
      &--today {
        color: var(--color-text);
        font-weight: var(--font-weight-bold);

        &::before {
          content: '';
          position: absolute;
          inset-block: 0;
          inset-inline-start: 0;
          width: var(--space-2xs);
          background-color: var(--color-action);
        }
      }
    }
  `,
})
export class OpeningTimes {
  readonly openingTimes = input.required<StationOpeningTimes>();
  /** Marks the matching weekday; the public holiday row is never marked. */
  readonly today = input.required<Date>();

  protected readonly openingDays = computed<OpeningDay[]>(() => {
    const today = weekdayOf(this.today());
    return DAYS_IN_DISPLAY_ORDER.map(day => {
      const intervals = this.openingTimes()[day];
      return {
        day,
        label: DAY_LABELS[day],
        hours:
          intervals.length === 0
            ? 'keine Angabe'
            : intervals.map(interval => `${interval.opening} - ${interval.closing}`).join(', '),
        isToday: day === today,
      };
    });
  });
}
