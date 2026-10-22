import { mapViewportPaddingFor } from './map-viewport-padding';

describe('mapViewportPaddingFor', () => {
  it('keeps a phone map clear of the map controls on top and the sheet at the bottom', () => {
    expect(
      mapViewportPaddingFor({
        isCompactViewport: true,
        mapControlsBottom: 115,
        sheetHeight: 380,
        panelRight: 0,
      })
    ).toEqual({ top: 115, right: 0, bottom: 380, left: 0 });
  });

  it('keeps a larger map clear of the floating side panel instead of a sheet', () => {
    expect(
      mapViewportPaddingFor({
        isCompactViewport: false,
        mapControlsBottom: 76,
        sheetHeight: 0,
        panelRight: 432,
      })
    ).toEqual({ top: 76, right: 0, bottom: 0, left: 432 });
  });

  it('ignores the side panel on phones, where it is the bottom sheet', () => {
    expect(
      mapViewportPaddingFor({
        isCompactViewport: true,
        mapControlsBottom: 60,
        sheetHeight: 120,
        panelRight: 390,
      }).left
    ).toBe(0);
  });

  it('never pads by a negative amount, e.g. before anything was measured', () => {
    expect(
      mapViewportPaddingFor({
        isCompactViewport: false,
        mapControlsBottom: -4,
        sheetHeight: 0,
        panelRight: -1,
      })
    ).toEqual({ top: 0, right: 0, bottom: 0, left: 0 });
  });
});
