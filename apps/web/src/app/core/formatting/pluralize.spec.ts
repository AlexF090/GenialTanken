import { pluralize } from './pluralize';

describe('pluralize', () => {
  it('uses the singular for one and the plural for zero and more', () => {
    expect(pluralize(1, 'Ort', 'Orte')).toBe('Ort');
    expect(pluralize(0, 'Ort', 'Orte')).toBe('Orte');
    expect(pluralize(2, 'Ort', 'Orte')).toBe('Orte');
  });
});
