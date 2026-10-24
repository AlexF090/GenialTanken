import {
  computed,
  DestroyRef,
  DOCUMENT,
  inject,
  Injectable,
  InjectionToken,
  signal,
  untracked,
} from '@angular/core';
import { LOCAL_STORAGE } from '../browser-storage';
import { injectMediaQueryMatches } from '../layout/media-query';
import { Logger } from '../logging/logger';

/**
 * How the app can be added to the home screen: through the browser's own install dialog
 * (`beforeinstallprompt`, Chromium on Android), or by following the steps of iOS (Share, then
 * "Add to Home Screen"), which has no such dialog.
 */
export type InstallationOffer = 'install-dialog' | 'home-screen-steps';

export const INSTALLATION_HINT_STORAGE_KEY = 'genialtanken.installation-hint';
const DISMISSED = 'dismissed';

/** Phones and tablets: a touch screen as the only pointer. */
export const TOUCH_DEVICE_MEDIA_QUERY = '(pointer: coarse) and (hover: none)';
/** Opened from the home screen as an installed app. */
export const STANDALONE_DISPLAY_MEDIA_QUERY = '(display-mode: standalone)';

/**
 * Whether the browser adds web apps to the home screen through its Share menu: iOS and iPadOS,
 * whose browsers alone know `navigator.standalone`.
 */
export const ADDS_TO_HOME_SCREEN_THROUGH_SHARE = new InjectionToken<boolean>(
  'AddsToHomeScreenThroughShare',
  {
    providedIn: 'root',
    factory: () => {
      const navigator = inject(DOCUMENT).defaultView?.navigator;
      return navigator !== undefined && 'standalone' in navigator;
    },
  }
);

/** `BeforeInstallPromptEvent`, which only Chromium knows (no type in the DOM library). */
interface InstallDialogEvent extends Event {
  prompt(): Promise<unknown>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isInstallDialogEvent = (event: Event): event is InstallDialogEvent =>
  'prompt' in event && typeof event.prompt === 'function' && 'userChoice' in event;

/**
 * Offers to add the app to the home screen, where it opens full screen without the browser's
 * bars, once per device: only in a browser on a touch device, not in the installed app, and
 * never again after the user closed the hint or installed the app. Created at startup, so it
 * catches the browser's `beforeinstallprompt`, which fires once and early.
 */
@Injectable({ providedIn: 'root' })
export class InstallationHint {
  private readonly storage = inject(LOCAL_STORAGE);
  private readonly logger = inject(Logger);
  private readonly isTouchDevice = injectMediaQueryMatches(TOUCH_DEVICE_MEDIA_QUERY);
  private readonly isStandalone = injectMediaQueryMatches(STANDALONE_DISPLAY_MEDIA_QUERY);
  private readonly addsToHomeScreenThroughShare = inject(ADDS_TO_HOME_SCREEN_THROUGH_SHARE);
  private readonly isDismissed = signal(this.readDismissed());
  private readonly installDialog = signal<InstallDialogEvent | undefined>(undefined);

  /** Whether the hint may show at all, whatever the browser offers. */
  private readonly isWanted = computed(
    () => this.isTouchDevice() && !this.isStandalone() && !this.isDismissed()
  );

  /** What the hint shows; `undefined` while it is hidden. */
  readonly offer = computed<InstallationOffer | undefined>(() => {
    if (!this.isWanted()) {
      return undefined;
    }
    if (this.installDialog() !== undefined) {
      return 'install-dialog';
    }
    return this.addsToHomeScreenThroughShare ? 'home-screen-steps' : undefined;
  });

  constructor() {
    const window = inject(DOCUMENT).defaultView;
    if (window === null) {
      return;
    }
    const keepInstallDialog = (event: Event): void => {
      // Without the hint (desktop, or closed by the user) the browser keeps its own install UI.
      if (!isInstallDialogEvent(event) || !untracked(this.isWanted)) {
        return;
      }
      // Keeps the browser from showing its own banner; the hint opens the dialog on request.
      event.preventDefault();
      this.installDialog.set(event);
    };
    const forgetAfterInstallation = (): void => {
      this.dismiss();
    };
    window.addEventListener('beforeinstallprompt', keepInstallDialog);
    window.addEventListener('appinstalled', forgetAfterInstallation);
    inject(DestroyRef).onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', keepInstallDialog);
      window.removeEventListener('appinstalled', forgetAfterInstallation);
    });
  }

  /**
   * Opens the browser's install dialog; the hint closes for good once the user installs. Never
   * rejects: a failing dialog is logged and only hides the used-up offer.
   */
  async install(): Promise<void> {
    const installDialog = this.installDialog();
    if (installDialog === undefined) {
      return;
    }
    // The browser opens its dialog only once per event.
    this.installDialog.set(undefined);
    try {
      await installDialog.prompt();
      const { outcome } = await installDialog.userChoice;
      if (outcome === 'accepted') {
        this.dismiss();
      }
    } catch (error: unknown) {
      this.logger.warn('The install dialog of the browser failed.', error);
    }
  }

  /** Hides the hint on this device for good. */
  dismiss(): void {
    this.isDismissed.set(true);
    try {
      this.storage.setItem(INSTALLATION_HINT_STORAGE_KEY, DISMISSED);
    } catch (error) {
      this.logger.warn(
        'The closed installation hint could not be saved; it shows again on the next visit.',
        error
      );
    }
  }

  private readDismissed(): boolean {
    try {
      return this.storage.getItem(INSTALLATION_HINT_STORAGE_KEY) === DISMISSED;
    } catch (error) {
      this.logger.warn('The installation hint could not read the browser storage.', error);
      return false;
    }
  }
}
