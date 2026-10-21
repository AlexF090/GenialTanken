const PERMISSION_DENIED = 1;
const POSITION_UNAVAILABLE = 2;
const TIMEOUT = 3;

interface PendingRequest {
  resolve: PositionCallback;
  reject: PositionErrorCallback | null | undefined;
}

/** Controllable `Geolocation`: requests stay pending until the test answers them. */
export class FakeGeolocation implements Geolocation {
  private readonly pendingRequests: PendingRequest[] = [];

  get pendingRequestCount(): number {
    return this.pendingRequests.length;
  }

  getCurrentPosition(
    successCallback: PositionCallback,
    errorCallback?: PositionErrorCallback | null
  ): void {
    this.pendingRequests.push({ resolve: successCallback, reject: errorCallback });
  }

  watchPosition(): number {
    throw new Error('FakeGeolocation does not support watchPosition');
  }

  clearWatch(): void {
    throw new Error('FakeGeolocation does not support clearWatch');
  }

  resolvePosition(latitude: number, longitude: number): void {
    const request = this.takeOldestRequest();
    const coordinates = {
      latitude,
      longitude,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
    };
    request.resolve({
      coords: { ...coordinates, toJSON: () => coordinates },
      timestamp: 0,
      toJSON: () => ({ coords: coordinates, timestamp: 0 }),
    });
  }

  rejectWithPermissionDenied(): void {
    this.reject(PERMISSION_DENIED, 'User denied Geolocation');
  }

  rejectWithPositionUnavailable(): void {
    this.reject(POSITION_UNAVAILABLE, 'Position unavailable');
  }

  rejectWithTimeout(): void {
    this.reject(TIMEOUT, 'Timeout expired');
  }

  private reject(code: number, message: string): void {
    const request = this.takeOldestRequest();
    request.reject?.({ code, message, PERMISSION_DENIED, POSITION_UNAVAILABLE, TIMEOUT });
  }

  private takeOldestRequest(): PendingRequest {
    const request = this.pendingRequests.shift();
    if (request === undefined) {
      throw new Error('FakeGeolocation has no pending getCurrentPosition request to answer');
    }
    return request;
  }
}
