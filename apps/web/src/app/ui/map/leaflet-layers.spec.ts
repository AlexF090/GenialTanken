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
