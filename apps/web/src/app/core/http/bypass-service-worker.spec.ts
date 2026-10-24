import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { bypassServiceWorkerForApi } from './bypass-service-worker';

describe('bypassServiceWorkerForApi', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([bypassServiceWorkerForApi])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('sends API requests past the service worker', () => {
    http.get('/api/stations').subscribe();

    expect(httpTesting.expectOne('/api/stations').request.headers.get('ngsw-bypass')).toBe('true');
  });

  it('leaves other requests to the service worker', () => {
    http.get('/manifest.webmanifest').subscribe();

    expect(httpTesting.expectOne('/manifest.webmanifest').request.headers.has('ngsw-bypass')).toBe(
      false
    );
  });
});
