import { TestBed } from '@angular/core/testing';
import { FakeGeolocation } from '../../../testing/fake-geolocation';
import { GEOLOCATION, GeolocationService } from './geolocation-service';

const createService = (geolocation: Geolocation | null): GeolocationService => {
  TestBed.configureTestingModule({ providers: [{ provide: GEOLOCATION, useValue: geolocation }] });
  return TestBed.inject(GeolocationService);
};

describe('GeolocationService', () => {
  it('exposes the position once the browser reports it', () => {
    const geolocation = new FakeGeolocation();
    const service = createService(geolocation);

    service.locate();
    expect(service.isLocating()).toBe(true);
    expect(service.position()).toBeUndefined();

    geolocation.resolvePosition(51.3127, 9.4797);

    expect(service.isLocating()).toBe(false);
    expect(service.position()).toEqual({ latitude: 51.3127, longitude: 9.4797 });
    expect(service.errorMessage()).toBeUndefined();
  });

  it('explains how to proceed when the permission is denied', () => {
    const geolocation = new FakeGeolocation();
    const service = createService(geolocation);

    service.locate();
    geolocation.rejectWithPermissionDenied();

    expect(service.isLocating()).toBe(false);
    expect(service.position()).toBeUndefined();
    expect(service.errorMessage()).toBe(
      'Der Zugriff auf deinen Standort wurde verweigert. Erlaube ihn in den Einstellungen deines Browsers, um Tankstellen in deiner Nähe zu sehen.'
    );
  });

  it('reports a timeout and an unavailable position', () => {
    const geolocation = new FakeGeolocation();
    const service = createService(geolocation);

    service.locate();
    geolocation.rejectWithTimeout();
    expect(service.errorMessage()).toBe(
      'Die Ermittlung deines Standorts hat zu lange gedauert. Bitte versuche es erneut.'
    );

    service.locate();
    geolocation.rejectWithPositionUnavailable();
    expect(service.errorMessage()).toBe(
      'Dein Standort konnte nicht ermittelt werden. Bitte versuche es erneut.'
    );
  });

  it('reports a browser without geolocation support', () => {
    const service = createService(null);

    service.locate();

    expect(service.errorMessage()).toBe('Dein Browser unterstützt keine Standortermittlung.');
  });

  it('keeps the last position while relocating', () => {
    const geolocation = new FakeGeolocation();
    const service = createService(geolocation);
    service.locate();
    geolocation.resolvePosition(51.3127, 9.4797);

    service.locate();

    expect(service.isLocating()).toBe(true);
    expect(service.position()).toEqual({ latitude: 51.3127, longitude: 9.4797 });
  });

  it('requests the position only once with locateOnce', () => {
    const geolocation = new FakeGeolocation();
    const service = createService(geolocation);

    service.locateOnce();
    service.locateOnce();

    expect(geolocation.pendingRequestCount).toBe(1);
  });
});
