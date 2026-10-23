import type { SearchCenter } from '../../core/search-center/search-center';
import { textOf } from '../../../testing/render-page';
import { L } from './leaflet';
import { createCenterMarker } from './leaflet-layers';

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

describe('createCenterMarker', () => {
  const renderCenter = (center: SearchCenter, inspect: (container: HTMLElement) => void): void => {
    withMap(map => {
      createCenterMarker(center).addTo(map);
      inspect(map.getContainer());
    });
  };

  it('marks a searched place with a pin named for screen readers, without parsing it as HTML', () => {
    renderCenter(
      { latitude: 48.86, longitude: 2.34, label: '<b>Gare du Nord</b>', source: 'place' },
      container => {
        const pin = container.querySelector('.location-pin');
        expect(pin?.getAttribute('role')).toBe('img');
        expect(pin?.getAttribute('aria-label')).toBe('<b>Gare du Nord</b>');
        expect(pin?.querySelector('b')).toBeNull();
      }
    );
  });

  it('shows no label on the map that could cover price tags', () => {
    renderCenter(
      { latitude: 48.86, longitude: 2.34, label: 'Eiffelturm, Paris', source: 'place' },
      container => {
        expect(container.querySelector('.leaflet-tooltip')).toBeNull();
        expect(textOf(container)).not.toContain('Eiffelturm, Paris');
      }
    );
  });

  it('shows the own position as a dot named for screen readers', () => {
    renderCenter(
      { latitude: 48.86, longitude: 2.34, label: 'Dein Standort', source: 'own-position' },
      container => {
        const dot = container.querySelector('.own-position-dot');
        expect(dot?.getAttribute('role')).toBe('img');
        expect(dot?.getAttribute('aria-label')).toBe('Dein Standort');
        expect(container.querySelector('.location-pin')).toBeNull();
      }
    );
  });
});
