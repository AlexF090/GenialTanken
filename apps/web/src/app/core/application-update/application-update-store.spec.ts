import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Logger } from '../logging/logger';
import { FakeServiceWorkerUpdate } from '../../../testing/fake-service-worker-update';
import { FakeStorage } from '../../../testing/fake-storage';
import { SESSION_STORAGE } from '../browser-storage';
import {
  ApplicationUpdateStore,
  AUTOMATIC_RELOAD_STORAGE_KEY,
  RELOAD_PAGE,
} from './application-update-store';

const VERSION = { hash: 'new' };

describe('ApplicationUpdateStore', () => {
  let serviceWorkerUpdate: FakeServiceWorkerUpdate;
  let reloadPage: ReturnType<typeof vi.fn<() => void>>;
  let logger: { error: ReturnType<typeof vi.fn> };
  let sessionStorage: Storage;

  const createStore = (
    options: { isEnabled?: boolean; sessionStorage?: Storage } = {}
  ): ApplicationUpdateStore => {
    serviceWorkerUpdate = new FakeServiceWorkerUpdate(options.isEnabled ?? true);
    reloadPage = vi.fn<() => void>();
    logger = { error: vi.fn() };
    sessionStorage = options.sessionStorage ?? new FakeStorage();
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: serviceWorkerUpdate },
        { provide: RELOAD_PAGE, useValue: reloadPage },
        { provide: Logger, useValue: logger },
        { provide: SESSION_STORAGE, useValue: sessionStorage },
      ],
    });
    return TestBed.inject(ApplicationUpdateStore);
  };

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

  it('reloads automatically only once per session and then asks the user', async () => {
    const store = createStore({
      sessionStorage: new FakeStorage({ [AUTOMATIC_RELOAD_STORAGE_KEY]: 'true' }),
    });

    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(reloadPage).not.toHaveBeenCalled();
    expect(store.pendingReload()).toBe('reload-required');

    await store.reload();

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(serviceWorkerUpdate.activations).toBe(0);
  });

  it('remembers the automatic reload for the rest of the session', () => {
    createStore();

    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(sessionStorage.getItem(AUTOMATIC_RELOAD_STORAGE_KEY)).toBe('true');
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
