import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  NetworkStatus,
  RECONNECT_DELAY_IN_MILLISECONDS,
  RETRY_DELAY_IN_MILLISECONDS,
  reloadWhenReconnected,
} from './network-status';

const goOffline = (): void => {
  window.dispatchEvent(new Event('offline'));
  TestBed.tick();
};

const goOnline = (): void => {
  window.dispatchEvent(new Event('online'));
  TestBed.tick();
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('NetworkStatus', () => {
  it('starts with the connection state of the browser', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);

    expect(TestBed.inject(NetworkStatus).isOnline()).toBe(false);
  });

  it('follows the offline and online events', () => {
    const networkStatus = TestBed.inject(NetworkStatus);

    goOffline();
    expect(networkStatus.isOnline()).toBe(false);

    goOnline();
    expect(networkStatus.isOnline()).toBe(true);
  });

  it('stops listening once its injector is destroyed', () => {
    const networkStatus = TestBed.inject(NetworkStatus);

    TestBed.resetTestingModule();
    goOffline();

    expect(networkStatus.isOnline()).toBe(true);
  });
});

class FakeReloadable {
  private readonly loading = signal(false);
  private readonly failure = signal<Error | undefined>(undefined);
  readonly isLoading = this.loading.asReadonly();
  readonly error = this.failure.asReadonly();
  reloads = 0;

  reload(): boolean {
    this.reloads += 1;
    this.loading.set(true);
    this.failure.set(undefined);
    return true;
  }

  finish(error?: Error): void {
    this.loading.set(false);
    this.failure.set(error);
    TestBed.tick();
  }
}

describe('reloadWhenReconnected', () => {
  let resource: FakeReloadable;

  const watchReloads = (): FakeReloadable => {
    resource = new FakeReloadable();
    TestBed.runInInjectionContext(() => {
      reloadWhenReconnected(resource);
    });
    TestBed.tick();
    return resource;
  };

  const waitFor = async (durationInMilliseconds: number): Promise<void> => {
    await vi.advanceTimersByTimeAsync(durationInMilliseconds);
    TestBed.tick();
  };

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not reload while the connection stays up', async () => {
    const reloadable = watchReloads();

    goOnline();
    await waitFor(RECONNECT_DELAY_IN_MILLISECONDS);

    expect(reloadable.reloads).toBe(0);
  });

  it('reloads shortly after the connection comes back, once it is likely usable', async () => {
    const reloadable = watchReloads();

    goOffline();
    goOnline();
    await waitFor(RECONNECT_DELAY_IN_MILLISECONDS - 1);
    expect(reloadable.reloads).toBe(0);

    await waitFor(1);
    expect(reloadable.reloads).toBe(1);

    reloadable.finish();
    await waitFor(RETRY_DELAY_IN_MILLISECONDS);
    expect(reloadable.reloads).toBe(1);
  });

  it('reloads when the app started offline and the connection comes up', async () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const reloadable = watchReloads();

    goOnline();
    await waitFor(RECONNECT_DELAY_IN_MILLISECONDS);

    expect(reloadable.reloads).toBe(1);
  });

  it('retries once after a while when the first reload fails', async () => {
    const reloadable = watchReloads();
    goOffline();
    goOnline();
    await waitFor(RECONNECT_DELAY_IN_MILLISECONDS);

    reloadable.finish(new Error('Bad Gateway'));
    await waitFor(RETRY_DELAY_IN_MILLISECONDS - 1);
    expect(reloadable.reloads).toBe(1);

    await waitFor(1);
    expect(reloadable.reloads).toBe(2);

    reloadable.finish(new Error('Bad Gateway'));
    await waitFor(RETRY_DELAY_IN_MILLISECONDS * 2);
    expect(reloadable.reloads).toBe(2);
  });

  it('does not reload when the connection drops again before the delay ends', async () => {
    const reloadable = watchReloads();

    goOffline();
    goOnline();
    goOffline();
    await waitFor(RECONNECT_DELAY_IN_MILLISECONDS);

    expect(reloadable.reloads).toBe(0);
  });

  it('does not retry once the connection dropped again', async () => {
    const reloadable = watchReloads();
    goOffline();
    goOnline();
    await waitFor(RECONNECT_DELAY_IN_MILLISECONDS);

    goOffline();
    reloadable.finish(new Error('Unknown Error'));
    await waitFor(RETRY_DELAY_IN_MILLISECONDS);

    expect(reloadable.reloads).toBe(1);
  });

  it('stops with its injector', async () => {
    const reloadable = watchReloads();
    goOffline();
    goOnline();

    TestBed.resetTestingModule();
    await vi.advanceTimersByTimeAsync(RECONNECT_DELAY_IN_MILLISECONDS);

    expect(reloadable.reloads).toBe(0);
  });
});
