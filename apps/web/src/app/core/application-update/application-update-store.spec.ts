import { TestBed } from '@angular/core/testing';
import { SwUpdate } from '@angular/service-worker';
import { Logger } from '../logging/logger';
import { FakeServiceWorkerUpdate } from '../../../testing/fake-service-worker-update';
import { ApplicationUpdateStore, RELOAD_PAGE } from './application-update-store';

const VERSION = { hash: 'new' };

describe('ApplicationUpdateStore', () => {
  let serviceWorkerUpdate: FakeServiceWorkerUpdate;
  let reloadPage: ReturnType<typeof vi.fn<() => void>>;
  let logger: { error: ReturnType<typeof vi.fn> };

  const createStore = (options: { isEnabled: boolean } = { isEnabled: true }) => {
    serviceWorkerUpdate = new FakeServiceWorkerUpdate(options.isEnabled);
    reloadPage = vi.fn<() => void>();
    logger = { error: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        { provide: SwUpdate, useValue: serviceWorkerUpdate },
        { provide: RELOAD_PAGE, useValue: reloadPage },
        { provide: Logger, useValue: logger },
      ],
    });
    return TestBed.inject(ApplicationUpdateStore);
  };

  it('has no update before the service worker reports one', () => {
    const store = createStore();

    serviceWorkerUpdate.versionUpdates.next({ type: 'VERSION_DETECTED', version: VERSION });

    expect(store.isUpdateReady()).toBe(false);
  });

  it('offers the update once a new version is ready', () => {
    const store = createStore();

    serviceWorkerUpdate.announceReadyVersion();

    expect(store.isUpdateReady()).toBe(true);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('ignores a failed installation', () => {
    const store = createStore();

    serviceWorkerUpdate.versionUpdates.next({
      type: 'VERSION_INSTALLATION_FAILED',
      version: VERSION,
      error: 'offline',
    });

    expect(store.isUpdateReady()).toBe(false);
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
    createStore();

    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(reloadPage).toHaveBeenCalledOnce();
    expect(logger.error).toHaveBeenCalledWith(
      'The service worker cannot serve this app version',
      'evicted'
    );
  });

  it('stays quiet without an enabled service worker', () => {
    const store = createStore({ isEnabled: false });

    serviceWorkerUpdate.announceReadyVersion();
    serviceWorkerUpdate.unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'evicted' });

    expect(store.isUpdateReady()).toBe(false);
    expect(reloadPage).not.toHaveBeenCalled();
  });

  it('stops listening once its injector is destroyed', () => {
    const store = createStore();

    TestBed.resetTestingModule();
    serviceWorkerUpdate.announceReadyVersion();

    expect(store.isUpdateReady()).toBe(false);
  });
});
