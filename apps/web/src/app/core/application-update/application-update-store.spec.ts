import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Logger } from '../logging/logger';
import { FakeServiceWorkerUpdate } from '../../../testing/fake-service-worker-update';
import { FakeStorage } from '../../../testing/fake-storage';
import { SESSION_STORAGE } from '../browser-storage';
import {
  ACTIVATION_TIMEOUT_IN_MILLISECONDS,
  ApplicationUpdateStore,
  AUTOMATIC_RELOAD_STORAGE_KEY,
  MINIMUM_TIME_BETWEEN_AUTOMATIC_RELOADS_IN_MILLISECONDS,
  RELOAD_PAGE,
} from './application-update-store';

const VERSION = { hash: 'new' };
const NOW = Date.parse('2026-10-23T12:00:00Z');

describe('ApplicationUpdateStore', () => {
  let serviceWorkerUpdate: FakeServiceWorkerUpdate;
  let reloadPage: ReturnType<typeof vi.fn<() => void>>;
  let logger: { error: ReturnType<typeof vi.fn>; warn: ReturnType<typeof vi.fn> };
  let sessionStorage: Storage;

  const createStore = (
    options: { isEnabled?: boolean; sessionStorage?: Storage; sessionStorageError?: Error } = {}
  ): ApplicationUpdateStore => {
    serviceWorkerUpdate = new FakeServiceWorkerUpdate(options.isEnabled ?? true);
    reloadPage = vi.fn<() => void>();
    logger = { error: vi.fn(), warn: vi.fn() };
    sessionStorage = options.sessionStorage ?? new FakeStorage();
    const { sessionStorageError } = options;
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: serviceWorkerUpdate },
        { provide: RELOAD_PAGE, useValue: reloadPage },
        { provide: Logger, useValue: logger },
        sessionStorageError === undefined
          ? { provide: SESSION_STORAGE, useValue: sessionStorage }
          : {
              provide: SESSION_STORAGE,
              useFactory: () => {
                throw sessionStorageError;
              },
            },
      ],
    });
    return TestBed.inject(ApplicationUpdateStore);
  };

  const breakCache = (): void => {
    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });
  };

  const setVisibilityState = (visibilityState: DocumentVisibilityState): void => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState,
    });
    document.dispatchEvent(new Event('visibilitychange'));
  };

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(document, 'visibilityState');
  });

  it('has no update before the service worker reports one', () => {
    const store = createStore();

    serviceWorkerUpdate.versionUpdates.next({ type: 'VERSION_DETECTED', version: VERSION });

    expect(store.pendingReload()).toBeUndefined();
  });

  it('offers the update once a new version is ready', () => {
    const store = createStore();

    serviceWorkerUpdate.announceReadyVersion();

    expect(store.pendingReload()).toBe('update-ready');
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('ignores a failed installation', () => {
    const store = createStore();

    serviceWorkerUpdate.versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: VERSION,
      error: 'offline',
    });

    expect(store.pendingReload()).toBeUndefined();
  });

  it('activates the new version before reloading', async () => {
    const store = createStore();

    await store.reload();

    expect(serviceWorkerUpdate.activations).toBe(1);
    expect(reloadPage).toHaveBeenCalledOnce();
  });

  it('still reloads when the activation fails', async () => {
    const store = createStore();
    serviceWorkerUpdate.activationError = new Error('no worker');

    await store.reload();

    expect(logger.error).toHaveBeenCalledWith(
      'Activating the new app version failed',
      serviceWorkerUpdate.activationError
    );
    expect(reloadPage).toHaveBeenCalledOnce();
  });

  it('reloads anyway when the activation does not settle in time', async () => {
    const store = createStore();
    serviceWorkerUpdate.activationHangs = true;

    const reload = store.reload();
    await vi.advanceTimersByTimeAsync(ACTIVATION_TIMEOUT_IN_MILLISECONDS - 1);

    expect(reloadPage).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    await reload;

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      'Activating the new app version failed',
      expect.any(Error)
    );
  });

  it('checks for a new version when the app becomes visible again', async () => {
    createStore();

    setVisibilityState('hidden');
    expect(serviceWorkerUpdate.updateChecks).toBe(0);

    setVisibilityState('visible');
    await vi.runAllTimersAsync();

    expect(serviceWorkerUpdate.updateChecks).toBe(1);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('logs a failed update check instead of throwing', async () => {
    createStore();
    serviceWorkerUpdate.updateCheckError = new Error('offline');

    setVisibilityState('visible');
    await vi.runAllTimersAsync();

    expect(logger.warn).toHaveBeenCalledWith(
      'Checking for a new app version failed',
      serviceWorkerUpdate.updateCheckError
    );
  });

  it('stops checking for new versions once its injector is destroyed', () => {
    createStore();

    TestBed.resetTestingModule();
    setVisibilityState('visible');

    expect(serviceWorkerUpdate.updateChecks).toBe(0);
  });

  it('reloads at once when the cached version is broken', () => {
    const store = createStore();

    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(store.pendingReload()).toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      'The service worker cannot serve this app version',
      'evicted'
    );
  });

  it('reloads automatically only once in a while and then asks the user', async () => {
    const store = createStore({
      sessionStorage: new FakeStorage({
        [AUTOMATIC_RELOAD_STORAGE_KEY]: String(
          NOW - MINIMUM_TIME_BETWEEN_AUTOMATIC_RELOADS_IN_MILLISECONDS + 1
        ),
      }),
    });

    breakCache();

    expect(reloadPage).not.toHaveBeenCalled();
    expect(store.pendingReload()).toBe('reload-required');

    await store.reload();

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(serviceWorkerUpdate.activations).toBe(0);
  });

  it('treats the marker of an older app version as a recent automatic reload', () => {
    const store = createStore({
      sessionStorage: new FakeStorage({ [AUTOMATIC_RELOAD_STORAGE_KEY]: 'true' }),
    });

    breakCache();

    expect(reloadPage).not.toHaveBeenCalled();
    expect(store.pendingReload()).toBe('reload-required');
  });

  it('reloads automatically again when the cache breaks long after the last automatic reload', () => {
    createStore({
      sessionStorage: new FakeStorage({
        [AUTOMATIC_RELOAD_STORAGE_KEY]: String(
          NOW - MINIMUM_TIME_BETWEEN_AUTOMATIC_RELOADS_IN_MILLISECONDS
        ),
      }),
    });

    breakCache();

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem(AUTOMATIC_RELOAD_STORAGE_KEY)).toBe(String(NOW));
  });

  it('remembers the automatic reload before reloading', () => {
    createStore();
    const setItem = vi.spyOn(sessionStorage, 'setItem');

    breakCache();

    expect(sessionStorage.getItem(AUTOMATIC_RELOAD_STORAGE_KEY)).toBe(String(NOW));
    expect(setItem.mock.invocationCallOrder[0]).toBeLessThan(
      reloadPage.mock.invocationCallOrder[0] ?? 0
    );
  });

  it('asks the user when the session storage cannot be opened', () => {
    const securityError = new DOMException('denied', 'SecurityError');
    const store = createStore({ sessionStorageError: securityError });

    breakCache();

    expect(reloadPage).not.toHaveBeenCalled();
    expect(store.pendingReload()).toBe('reload-required');
    expect(logger.error).toHaveBeenCalledWith(
      'Cannot remember the automatic reload for this session',
      securityError
    );
  });

  it('asks the user when the session storage cannot be read', () => {
    const failingStorage = new FakeStorage();
    const securityError = new DOMException('denied', 'SecurityError');
    vi.spyOn(failingStorage, 'getItem').mockImplementation(() => {
      throw securityError;
    });
    const store = createStore({ sessionStorage: failingStorage });

    breakCache();

    expect(reloadPage).not.toHaveBeenCalled();
    expect(store.pendingReload()).toBe('reload-required');
  });

  it('asks the user instead of risking a reload loop when the session storage fails', () => {
    const failingStorage = new FakeStorage();
    const quotaExceeded = new DOMException('full', 'QuotaExceededError');
    vi.spyOn(failingStorage, 'setItem').mockImplementation(() => {
      throw quotaExceeded;
    });
    const store = createStore({ sessionStorage: failingStorage });

    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(reloadPage).not.toHaveBeenCalled();
    expect(store.pendingReload()).toBe('reload-required');
    expect(logger.error).toHaveBeenCalledWith(
      'Cannot remember the automatic reload for this session',
      quotaExceeded
    );
  });

  it('keeps asking for the reload when a new version becomes ready afterwards', () => {
    const store = createStore({
      sessionStorage: new FakeStorage({ [AUTOMATIC_RELOAD_STORAGE_KEY]: 'true' }),
    });

    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });
    serviceWorkerUpdate.announceReadyVersion();

    expect(store.pendingReload()).toBe('reload-required');
  });

  it('stays quiet without an enabled service worker', () => {
    const store = createStore({ isEnabled: false });

    serviceWorkerUpdate.announceReadyVersion();
    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(store.pendingReload()).toBeUndefined();
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('stops listening once its injector is destroyed', () => {
    const store = createStore();

    TestBed.resetTestingModule();
    serviceWorkerUpdate.announceReadyVersion();

    expect(store.pendingReload()).toBeUndefined();
  });
});
