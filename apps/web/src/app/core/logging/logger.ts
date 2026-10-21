import { Injectable } from '@angular/core';

/**
 * The single place where the browser app writes to the console, so tests can spy on or replace it.
 * Only `main.ts` logs directly, because bootstrap errors happen before dependency injection exists.
 */
@Injectable({ providedIn: 'root' })
export class Logger {
  warn(message: string, ...details: unknown[]): void {
    console.warn(message, ...details);
  }

  error(message: string, ...details: unknown[]): void {
    console.error(message, ...details);
  }
}
