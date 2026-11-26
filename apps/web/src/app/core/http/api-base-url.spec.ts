import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api-base-url';

describe('API_BASE_URL', () => {
  it('is the same-origin /api path in development and tests, served by the dev proxy', () => {
    expect(TestBed.inject(API_BASE_URL)).toBe('/api');
  });

  it('can be replaced by the absolute URL of the API', () => {
    TestBed.configureTestingModule({
      providers: [{ provide: API_BASE_URL, useValue: 'https://api.example/api' }],
    });

    expect(TestBed.inject(API_BASE_URL)).toBe('https://api.example/api');
  });
});
