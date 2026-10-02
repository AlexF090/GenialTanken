import {
  nearestSnapPosition,
  nextSnapPositionOnActivation,
  snapHeights,
  steppedSnapPosition,
} from './bottom-sheet-snap';
import type { SnapHeights } from './bottom-sheet-snap';

const heights: SnapHeights = { peek: 100, half: 400, full: 800 };

describe('snapHeights', () => {
  it('derives half from the sheet height and keeps the order peek ≤ half ≤ full', () => {
    expect(snapHeights({ sheetHeight: 800, peekHeight: 120 })).toEqual({
      peek: 120,
      half: 400,
      full: 800,
    });
  });

  it('never lets half drop below peek or peek exceed the sheet', () => {
    expect(snapHeights({ sheetHeight: 200, peekHeight: 150 })).toEqual({
      peek: 150,
      half: 150,
      full: 200,
    });
    expect(snapHeights({ sheetHeight: 100, peekHeight: 150 })).toEqual({
      peek: 100,
      half: 100,
      full: 100,
    });
  });
});

describe('nearestSnapPosition', () => {
  it('snaps a slow release to the closest height', () => {
    expect(nearestSnapPosition({ visibleHeight: 230, velocity: 0, heights })).toBe('peek');
    expect(nearestSnapPosition({ visibleHeight: 300, velocity: 0, heights })).toBe('half');
    expect(nearestSnapPosition({ visibleHeight: 640, velocity: 0, heights })).toBe('full');
  });

  it('follows an upward flick past the closest height', () => {
    expect(nearestSnapPosition({ visibleHeight: 450, velocity: 1.5, heights })).toBe('full');
  });

  it('follows a downward flick past the closest height', () => {
    expect(nearestSnapPosition({ visibleHeight: 380, velocity: -1.5, heights })).toBe('peek');
  });

  it('does not overshoot beyond the extremes', () => {
    expect(nearestSnapPosition({ visibleHeight: 790, velocity: 5, heights })).toBe('full');
    expect(nearestSnapPosition({ visibleHeight: 110, velocity: -5, heights })).toBe('peek');
  });

  it('prefers the smaller position when two positions share a height', () => {
    expect(
      nearestSnapPosition({
        visibleHeight: 150,
        velocity: 0,
        heights: { peek: 150, half: 150, full: 200 },
      })
    ).toBe('peek');
  });
});

describe('steppedSnapPosition', () => {
  it('steps up and down and stops at the ends', () => {
    expect(steppedSnapPosition('peek', 'up')).toBe('half');
    expect(steppedSnapPosition('half', 'up')).toBe('full');
    expect(steppedSnapPosition('full', 'up')).toBe('full');
    expect(steppedSnapPosition('full', 'down')).toBe('half');
    expect(steppedSnapPosition('half', 'down')).toBe('peek');
    expect(steppedSnapPosition('peek', 'down')).toBe('peek');
  });
});

describe('nextSnapPositionOnActivation', () => {
  it('cycles peek, half, full, half, peek', () => {
    expect(nextSnapPositionOnActivation('peek', 'up')).toEqual({
      position: 'half',
      direction: 'up',
    });
    expect(nextSnapPositionOnActivation('half', 'up')).toEqual({
      position: 'full',
      direction: 'up',
    });
    expect(nextSnapPositionOnActivation('full', 'up')).toEqual({
      position: 'half',
      direction: 'down',
    });
    expect(nextSnapPositionOnActivation('half', 'down')).toEqual({
      position: 'peek',
      direction: 'down',
    });
    expect(nextSnapPositionOnActivation('peek', 'down')).toEqual({
      position: 'half',
      direction: 'up',
    });
  });
});
