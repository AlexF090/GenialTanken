import { TestBed } from '@angular/core/testing';
import { NetworkStatus, reloadWhenReconnected } from './network-status';

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

describe('reloadWhenReconnected', () => {
  const watchReloads = (): { count: number } => {
    const reloads = { count: 0 };
    TestBed.runInInjectionContext(() => {
      reloadWhenReconnected({
        reload: () => {
          reloads.count += 1;
        },
      });
    });
    TestBed.tick();
    return reloads;
  };

  it('does not reload while the connection stays up', () => {
    const reloads = watchReloads();

    goOnline();

    expect(reloads.count).toBe(0);
  });

  it('reloads once when the connection comes back', () => {
    const reloads = watchReloads();

    goOffline();
    expect(reloads.count).toBe(0);

    goOnline();
    expect(reloads.count).toBe(1);
  });

  it('reloads when the app started offline and the connection comes up', () => {
    vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(false);
    const reloads = watchReloads();

    goOnline();

    expect(reloads.count).toBe(1);
  });
});
