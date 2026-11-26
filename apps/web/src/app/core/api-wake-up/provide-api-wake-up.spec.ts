import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import type { MockInstance } from 'vitest';
import { Logger } from '../logging/logger';
import { bypassServiceWorkerForApi } from '../http/bypass-service-worker';
import { API_BASE_URL } from '../http/api-base-url';
import { provideApiWakeUp } from './provide-api-wake-up';

const API_WAKE_UP_URL = '/api/wake-up';

describe('provideApiWakeUp', () => {
  let httpTesting: HttpTestingController;
  let warn: MockInstance<Logger['warn']>;
  let error: MockInstance<Logger['error']>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideApiWakeUp(),
        provideHttpClient(withInterceptors([bypassServiceWorkerForApi])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);
    const logger = TestBed.inject(Logger);
    warn = vi.spyOn(logger, 'warn');
    error = vi.spyOn(logger, 'error');
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('wakes the API up on start, past the service worker', () => {
    const request = httpTesting.expectOne(API_WAKE_UP_URL);

    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('ngsw-bypass')).toBe('true');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('ignores a failed wake-up, because the stations request reports problems itself', () => {
    httpTesting.expectOne(API_WAKE_UP_URL).flush(null, { status: 502, statusText: 'Bad Gateway' });

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('ignores a wake-up while offline', () => {
    httpTesting.expectOne(API_WAKE_UP_URL).error(new ProgressEvent('error'));

    expect(error).not.toHaveBeenCalled();
  });

  it('wakes the API up at its absolute base URL', () => {
    httpTesting.expectOne(API_WAKE_UP_URL).flush(null, { status: 204, statusText: 'No Content' });
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: 'https://api.example/api' },
        provideApiWakeUp(),
        provideHttpClient(withInterceptors([bypassServiceWorkerForApi])),
        provideHttpClientTesting(),
      ],
    });
    httpTesting = TestBed.inject(HttpTestingController);

    const request = httpTesting.expectOne('https://api.example/api/wake-up');

    expect(request.request.headers.get('ngsw-bypass')).toBe('true');
    request.flush(null, { status: 204, statusText: 'No Content' });
  });
});
