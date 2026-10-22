import { Pipe } from '@angular/core';
import type { PipeTransform } from '@angular/core';
import { formatKilometers } from './number-format';

@Pipe({ name: 'kilometers' })
export class KilometersPipe implements PipeTransform {
  transform(kilometers: number): string {
    return formatKilometers(kilometers);
  }
}
