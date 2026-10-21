import { DEFAULT_SEARCH_CENTER } from '../../core/search-center/search-center';
import type { SearchCenter } from '../../core/search-center/search-center';
import { describeResult } from './result-summary';

const MAP_AREA: SearchCenter = {
  latitude: 48.8532,
  longitude: 2.3692,
  label: 'Kartenmitte',
  source: 'map-area',
};

describe('describeResult', () => {
  it('names count, radius and search center', () => {
    expect(describeResult(3, 5, DEFAULT_SEARCH_CENTER)).toBe(
      '3 Tankstellen im Umkreis von 5\u00a0km um Eiffelturm, Paris'
    );
  });

  it('uses the singular for a single station and the plural for none', () => {
    expect(describeResult(1, 10, DEFAULT_SEARCH_CENTER)).toBe(
      '1 Tankstelle im Umkreis von 10\u00a0km um Eiffelturm, Paris'
    );
    expect(describeResult(0, 10, DEFAULT_SEARCH_CENTER)).toBe(
      '0 Tankstellen im Umkreis von 10\u00a0km um Eiffelturm, Paris'
    );
  });

  it('calls a search in the map area "die Kartenmitte"', () => {
    expect(describeResult(2, 5, MAP_AREA)).toBe(
      '2 Tankstellen im Umkreis von 5\u00a0km um die Kartenmitte'
    );
  });
});
