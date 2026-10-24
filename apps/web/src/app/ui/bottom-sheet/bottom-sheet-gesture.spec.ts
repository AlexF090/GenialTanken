import { contentGestureDecision, wheelTarget } from './bottom-sheet-gesture';

describe('contentGestureDecision', () => {
  const decide = (overrides: Partial<Parameters<typeof contentGestureDecision>[0]>) =>
    contentGestureDecision({
      position: 'half',
      startScrollTop: 0,
      dx: 0,
      dy: 0,
      threshold: 4,
      ...overrides,
    });

  it('claims an upward swipe at half and at peek', () => {
    expect(decide({ position: 'half', dy: -20 })).toBe('claim');
    expect(decide({ position: 'peek', dy: -20 })).toBe('claim');
  });

  it('claims a downward swipe where the content cannot scroll', () => {
    expect(decide({ position: 'half', dy: 20 })).toBe('claim');
  });

  it('waits while the finger moved less than the threshold', () => {
    expect(decide({ dy: -2 })).toBe('undecided');
    expect(decide({ position: 'full', dy: 2 })).toBe('undecided');
  });

  it('releases a mostly horizontal swipe', () => {
    expect(decide({ dx: 30, dy: -10 })).toBe('release');
  });

  it('claims a downward swipe at full from the top of the list', () => {
    expect(decide({ position: 'full', dy: 20 })).toBe('claim');
    expect(decide({ position: 'full', startScrollTop: 0.4, dy: 20 })).toBe('claim');
  });

  it('releases an upward swipe at full so the list scrolls', () => {
    expect(decide({ position: 'full', dy: -20 })).toBe('release');
  });

  it('releases a swipe at full that starts in a scrolled list', () => {
    expect(decide({ position: 'full', startScrollTop: 120, dy: 20 })).toBe('release');
  });
});

describe('wheelTarget', () => {
  const step = (overrides: Partial<Parameters<typeof wheelTarget>[0]>) =>
    wheelTarget({
      position: 'half',
      scrollTop: 0,
      deltaY: 40,
      deltaMode: 0,
      ctrlKey: false,
      timeStamp: 1000,
      lock: undefined,
      ...overrides,
    });
  const target = (overrides: Partial<Parameters<typeof wheelTarget>[0]>) => {
    const { target, swallow } = step(overrides);
    return { target, swallow };
  };

  it('opens fully when scrolling down at half or peek', () => {
    expect(target({ position: 'half' })).toEqual({ target: 'full', swallow: true });
    expect(target({ position: 'peek' })).toEqual({ target: 'full', swallow: true });
  });

  it('lowers to half when scrolling up at full from the top of the list', () => {
    expect(target({ position: 'full', deltaY: -40 })).toEqual({ target: 'half', swallow: true });
    expect(target({ position: 'full', scrollTop: 0.4, deltaY: -40 })).toEqual({
      target: 'half',
      swallow: true,
    });
  });

  it('leaves the list to scroll at full', () => {
    expect(target({ position: 'full', deltaY: 40 })).toEqual({ target: null, swallow: false });
    expect(target({ position: 'full', scrollTop: 120, deltaY: -40 })).toEqual({
      target: null,
      swallow: false,
    });
  });

  it('ignores pinch zoom and a wheel without vertical movement', () => {
    expect(target({ ctrlKey: true })).toEqual({ target: null, swallow: false });
    expect(target({ deltaY: 0 })).toEqual({ target: null, swallow: false });
  });

  it('ignores micro deltas of a few pixels', () => {
    expect(target({ deltaY: 1 })).toEqual({ target: null, swallow: false });
    expect(target({ deltaY: -4, position: 'full' })).toEqual({ target: null, swallow: false });
    expect(target({ deltaY: 0.4, deltaMode: 0 })).toEqual({ target: null, swallow: false });
    expect(target({ deltaY: 5 }).target).toBe('full');
  });

  it('swallows the trailing events of a trackpad right after a step', () => {
    const lock = { timeStamp: 900, direction: 1 } as const;
    expect(target({ lock })).toEqual({ target: null, swallow: true });
    expect(target({ position: 'full', deltaY: 40, lock })).toEqual({ target: null, swallow: true });
  });

  it('swallows micro deltas while the lock holds', () => {
    expect(target({ deltaY: 1, lock: { timeStamp: 900, direction: 1 } as const })).toEqual({
      target: null,
      swallow: true,
    });
  });

  it('keeps the lock as long as events arrive without a larger gap', () => {
    let lock = step({ timeStamp: 1000 }).lock;
    for (let timeStamp = 1100; timeStamp <= 2000; timeStamp += 100) {
      const result = step({ position: 'full', timeStamp, lock });
      expect(result).toMatchObject({ target: null, swallow: true });
      lock = result.lock;
    }
  });

  it('steps again once the gap has passed', () => {
    expect(target({ lock: { timeStamp: 700, direction: 1 } as const })).toEqual({
      target: 'full',
      swallow: true,
    });
  });

  it('lets a reversed scroll break the lock', () => {
    expect(
      target({ position: 'full', deltaY: -40, lock: { timeStamp: 990, direction: 1 } as const })
    ).toEqual({ target: 'half', swallow: true });
  });

  it('counts lines and pages as pixels', () => {
    expect(target({ deltaY: -1, deltaMode: 1, position: 'full' }).target).toBe('half');
    expect(target({ deltaY: 0.01, deltaMode: 2 }).target).toBe('full');
    expect(target({ deltaY: 0.001, deltaMode: 2 }).target).toBeNull();
  });
});
