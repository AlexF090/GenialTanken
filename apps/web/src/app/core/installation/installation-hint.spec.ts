import { TestBed } from '@angular/core/testing';
import { BROWSER_STORAGE } from '../browser-storage';
import { MATCH_MEDIA } from '../layout/media-query';
import { Logger } from '../logging/logger';
import { FakeMatchMedia } from '../../../testing/fake-match-media';
import { FakeStorage } from '../../../testing/fake-storage';
import {
  ADDS_TO_HOME_SCREEN_THROUGH_SHARE,
  INSTALLATION_HINT_STORAGE_KEY,
  InstallationHint,
  STANDALONE_DISPLAY_MEDIA_QUERY,
  TOUCH_DEVICE_MEDIA_QUERY,
} from './installation-hint';

interface Device {
  matchingMediaQueries?: string[];
  addsToHomeScreenThroughShare?: boolean;
  storage?: Storage;
}

const IPHONE_IN_SAFARI: Device = {
  matchingMediaQueries: [TOUCH_DEVICE_MEDIA_QUERY],
  addsToHomeScreenThroughShare: true,
};

const ANDROID_IN_CHROME: Device = {
  matchingMediaQueries: [TOUCH_DEVICE_MEDIA_QUERY],
  addsToHomeScreenThroughShare: false,
};

const createHint = (device: Device) => {
  const matchMedia = new FakeMatchMedia(device.matchingMediaQueries);
  const storage = device.storage ?? new FakeStorage();
  TestBed.configureTestingModule({
    providers: [
      { provide: MATCH_MEDIA, useValue: matchMedia.matchMedia },
      { provide: BROWSER_STORAGE, useValue: storage },
      {
        provide: ADDS_TO_HOME_SCREEN_THROUGH_SHARE,
        useValue: device.addsToHomeScreenThroughShare ?? false,
      },
    ],
  });
  return { hint: TestBed.inject(InstallationHint), matchMedia, storage };
};

const installDialogEvent = (outcome: 'accepted' | 'dismissed') => {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(() => Promise.resolve());
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { event, prompt };
};

describe('InstallationHint', () => {
  it('shows the steps of iOS in a browser on an iPhone', () => {
    const { hint } = createHint(IPHONE_IN_SAFARI);

    expect(hint.offer()).toBe('home-screen-steps');
  });

  it('stays hidden on devices with a mouse or trackpad', () => {
    const { hint } = createHint({ addsToHomeScreenThroughShare: true });

    expect(hint.offer()).toBeUndefined();
  });

  it('stays hidden in the installed app', () => {
    const { hint, matchMedia } = createHint(IPHONE_IN_SAFARI);

    matchMedia.setMatches(STANDALONE_DISPLAY_MEDIA_QUERY, true);

    expect(hint.offer()).toBeUndefined();
  });

  it('stays hidden in browsers that offer neither an install dialog nor the steps of iOS', () => {
    const { hint } = createHint(ANDROID_IN_CHROME);

    expect(hint.offer()).toBeUndefined();
  });

  it('closes for good once dismissed', () => {
    const { hint, storage } = createHint(IPHONE_IN_SAFARI);

    hint.dismiss();

    expect(hint.offer()).toBeUndefined();
    expect(storage.getItem(INSTALLATION_HINT_STORAGE_KEY)).toBe('dismissed');
  });

  it('stays hidden after it was dismissed on an earlier visit', () => {
    const { hint } = createHint({
      ...IPHONE_IN_SAFARI,
      storage: new FakeStorage({ [INSTALLATION_HINT_STORAGE_KEY]: 'dismissed' }),
    });

    expect(hint.offer()).toBeUndefined();
  });

  it('still closes for this visit when the storage cannot save it', () => {
    const storage = new FakeStorage();
    vi.spyOn(storage, 'setItem').mockImplementation(() => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    });
    const { hint } = createHint({ ...IPHONE_IN_SAFARI, storage });
    const warn = vi.spyOn(TestBed.inject(Logger), 'warn').mockImplementation(() => undefined);

    hint.dismiss();

    expect(hint.offer()).toBeUndefined();
    expect(warn).toHaveBeenCalledOnce();
  });

  it('offers the install dialog of the browser in place of its own banner', () => {
    const { hint } = createHint(ANDROID_IN_CHROME);
    const { event } = installDialogEvent('accepted');

    window.dispatchEvent(event);

    expect(hint.offer()).toBe('install-dialog');
    expect(event.defaultPrevented).toBe(true);
  });

  it('leaves the install UI of the browser alone on devices with a mouse or trackpad', () => {
    const { hint } = createHint({});
    const { event } = installDialogEvent('accepted');

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(hint.offer()).toBeUndefined();
  });

  it('leaves the install UI of the browser alone once the hint was dismissed', () => {
    const { hint } = createHint({
      ...ANDROID_IN_CHROME,
      storage: new FakeStorage({ [INSTALLATION_HINT_STORAGE_KEY]: 'dismissed' }),
    });
    const { event } = installDialogEvent('accepted');

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
    expect(hint.offer()).toBeUndefined();
  });

  it('leaves the install UI of the browser alone in the installed app', () => {
    const { matchMedia } = createHint(ANDROID_IN_CHROME);
    matchMedia.setMatches(STANDALONE_DISPLAY_MEDIA_QUERY, true);
    const { event } = installDialogEvent('accepted');

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });

  it('opens the install dialog and closes for good once the user installs', async () => {
    const { hint, storage } = createHint(ANDROID_IN_CHROME);
    const { event, prompt } = installDialogEvent('accepted');
    window.dispatchEvent(event);

    await hint.install();

    expect(prompt).toHaveBeenCalledOnce();
    expect(hint.offer()).toBeUndefined();
    expect(storage.getItem(INSTALLATION_HINT_STORAGE_KEY)).toBe('dismissed');
  });

  it('is not saved as dismissed when the user cancels the install dialog', async () => {
    const { hint, storage } = createHint(ANDROID_IN_CHROME);
    window.dispatchEvent(installDialogEvent('dismissed').event);

    await hint.install();

    // The browser opens its dialog only once per event; it may announce a new one later.
    expect(hint.offer()).toBeUndefined();
    expect(storage.getItem(INSTALLATION_HINT_STORAGE_KEY)).toBeNull();
    window.dispatchEvent(installDialogEvent('accepted').event);
    expect(hint.offer()).toBe('install-dialog');
  });

  it('closes for good once the app was installed another way', () => {
    const { hint } = createHint(IPHONE_IN_SAFARI);

    window.dispatchEvent(new Event('appinstalled'));

    expect(hint.offer()).toBeUndefined();
  });

  it('stops listening to the browser when the application is destroyed', () => {
    const { hint } = createHint(ANDROID_IN_CHROME);

    TestBed.resetTestingModule();
    window.dispatchEvent(installDialogEvent('accepted').event);

    expect(hint.offer()).toBeUndefined();
  });
});
