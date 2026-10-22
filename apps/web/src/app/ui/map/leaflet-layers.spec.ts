import type { SearchCenter } from '../../core/search-center/search-center';
import { accessibleTextOf, textOf } from '../../../testing/render-page';
import { L } from './leaflet';
import { createCenterMarker, createClusterIcon, StationMarker } from './leaflet-layers';
import type { StationMarkerOptions } from './leaflet-layers';
import { createPriceTagIcon } from './price-tag-icons';
import type { PriceTagIconOptions } from './price-tag-icons';

const renderIcon = (icon: L.DivIcon): HTMLElement => icon.createIcon();

const priceTag = (options: Partial<PriceTagIconOptions>): HTMLElement =>
  renderIcon(
    createPriceTagIcon({
      accessibleName: 'TotalEnergies',
      priceInEuro: 1.859,
      isCheapest: false,
      isSelected: false,
      ...options,
    })
  );

/**
 * Visible caption naming the cheapest price; screen readers get it through the accessible name,
 * so it must be hidden from them.
 */
const cheapestCaptionOf = (element: HTMLElement): string | undefined => {
  const caption = element.querySelector('.price-tag__caption, .price-cluster__caption');
  if (caption === null) {
    return undefined;
  }
  expect(caption.closest('[aria-hidden="true"]')).not.toBeNull();
  return textOf(caption);
};

const stationMarker = (options: Partial<StationMarkerOptions>): StationMarker =>
  new StationMarker({
    stationIdentifier: 'fr-1',
    coordinates: { latitude: 48.86, longitude: 2.34 },
    title: 'TotalEnergies',
    priceInEuro: 1.859,
    isCheapest: false,
    isSelected: false,
    ...options,
  });

const withMap = (callback: (map: L.Map) => void): void => {
  const container = document.createElement('div');
  document.body.append(container);
  const map = L.map(container).setView([48.86, 2.34], 13);
  try {
    callback(map);
  } finally {
    map.remove();
    container.remove();
  }
};

describe('createPriceTagIcon', () => {
  it('shows the price with a raised tenth of a cent and names the station', () => {
    const element = priceTag({});

    expect(accessibleTextOf(element)).toBe('TotalEnergies, 1,859 €');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('1,859');
    expect(element.querySelector('[aria-hidden="true"] sup')?.textContent).toBe('9');
  });

  it('tells screen reader users which price is the cheapest', () => {
    expect(accessibleTextOf(priceTag({ isCheapest: true }))).toBe(
      'TotalEnergies, 1,859 €, günstigster Preis'
    );
  });

  it('marks the cheapest price with a visible caption, not with color alone', () => {
    expect(cheapestCaptionOf(priceTag({ isCheapest: true }))).toBe('günstigst');
    expect(cheapestCaptionOf(priceTag({ isCheapest: false }))).toBeUndefined();
  });

  it('tints the tag by its price level, and not at all without a level', () => {
    const tagClasses = (options: Partial<PriceTagIconOptions>): string =>
      priceTag(options).querySelector('.price-tag')?.className ?? '';

    expect(tagClasses({ priceLevel: 'medium' })).toContain('price-tag--medium');
    expect(tagClasses({})).not.toMatch(/price-tag--(low|medium|high)/);
  });

  it('shows a dash for a station without a price of the selected fuel', () => {
    const element = priceTag({ priceInEuro: null });

    expect(accessibleTextOf(element)).toBe('TotalEnergies, kein Preis');
    expect(element.querySelector('[aria-hidden="true"]')?.textContent).toBe('–');
  });

  it('never interprets the station name as HTML', () => {
    const element = priceTag({ accessibleName: '<img src=x onerror=alert(1)>' });

    expect(element.querySelector('img')).toBeNull();
    expect(accessibleTextOf(element)).toBe('<img src=x onerror=alert(1)>, 1,859 €');
  });
});

describe('createClusterIcon', () => {
  it('shows the number of stations and their lowest price', () => {
    const markers = [
      stationMarker({ priceInEuro: 1.859 }),
      stationMarker({ priceInEuro: null }),
      stationMarker({ priceInEuro: 1.799 }),
    ];

    const element = renderIcon(
      createClusterIcon({ getChildCount: () => 3, getAllChildMarkers: () => markers })
    );

    expect(accessibleTextOf(element)).toBe('3 Tankstellen, ab 1,799 €');
    expect(textOf(element.querySelector('[aria-hidden="true"]'))).toBe('3');
  });

  it('is tinted like the tag of its lowest price', () => {
    const markers = [
      stationMarker({ priceInEuro: 1.859, priceLevel: 'high' }),
      stationMarker({ priceInEuro: 1.799, priceLevel: 'low' }),
    ];

    const element = renderIcon(
      createClusterIcon({ getChildCount: () => 2, getAllChildMarkers: () => markers })
    );

    const clusterClasses = element.querySelector('.price-cluster')?.className ?? '';
    expect(clusterClasses).toContain('price-cluster--low');
    expect(clusterClasses).not.toContain('price-cluster--high');
  });

  it('marks a cluster containing the cheapest station with a visible caption', () => {
    const markers = [
      stationMarker({ priceInEuro: 1.799, isCheapest: true }),
      stationMarker({ priceInEuro: 1.859 }),
    ];

    const element = renderIcon(
      createClusterIcon({ getChildCount: () => 2, getAllChildMarkers: () => markers })
    );

    expect(accessibleTextOf(element)).toBe('2 Tankstellen, ab 1,799 €');
    expect(cheapestCaptionOf(element)).toBe('günstigst');
  });

  it('has no caption for a cluster without the cheapest station', () => {
    const markers = [stationMarker({ priceInEuro: 1.859 }), stationMarker({ priceInEuro: 1.899 })];

    const element = renderIcon(
      createClusterIcon({ getChildCount: () => 2, getAllChildMarkers: () => markers })
    );

    expect(cheapestCaptionOf(element)).toBeUndefined();
  });

  it('says so when none of the stations has a price', () => {
    const markers = [stationMarker({ priceInEuro: null }), stationMarker({ priceInEuro: null })];

    const element = renderIcon(
      createClusterIcon({ getChildCount: () => 2, getAllChildMarkers: () => markers })
    );

    expect(accessibleTextOf(element)).toBe('2 Tankstellen, kein Preis');
  });
});

describe('StationMarker', () => {
  it('is a keyboard-focusable toggle button reflecting the selection', () => {
    withMap(map => {
      const marker = stationMarker({}).addTo(map);
      const element = marker.getElement();

      expect(element?.getAttribute('role')).toBe('button');
      expect(element?.getAttribute('tabindex')).toBe('0');
      expect(element?.getAttribute('aria-pressed')).toBe('false');
      expect(accessibleTextOf(element)).toBe('TotalEnergies, 1,859 €');

      marker.setSelected(true);

      expect(marker.getElement()?.getAttribute('aria-pressed')).toBe('true');
    });
  });

  it('is clicked with the space key like a native button', () => {
    withMap(map => {
      const marker = stationMarker({}).addTo(map);
      const clicks: unknown[] = [];
      marker.on('click', event => clicks.push(event));

      marker.getElement()?.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }));

      expect(clicks).toHaveLength(1);
    });
  });
});

describe('createCenterMarker', () => {
  const tooltipText = (center: SearchCenter): string => {
    let text = '';
    withMap(map => {
      createCenterMarker(center).addTo(map);
      text = textOf(map.getContainer().querySelector('.leaflet-tooltip'));
    });
    return text;
  };

  it('labels a searched place with its name, without parsing it as HTML', () => {
    expect(
      tooltipText({
        latitude: 48.86,
        longitude: 2.34,
        label: '<b>Gare du Nord</b>',
        source: 'place',
      })
    ).toBe('<b>Gare du Nord</b>');
  });

  it('greets the user at their own position', () => {
    expect(
      tooltipText({
        latitude: 48.86,
        longitude: 2.34,
        label: 'Dein Standort',
        source: 'own-position',
      })
    ).toBe('Du bist hier!');
  });

  it('leaves the center of a moved map area unlabeled', () => {
    expect(
      tooltipText({
        latitude: 48.86,
        longitude: 2.34,
        label: 'Kartenmitte',
        source: 'map-area',
      })
    ).toBe('');
  });
});
