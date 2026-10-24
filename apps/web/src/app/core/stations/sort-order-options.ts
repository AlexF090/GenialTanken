import type { LabeledOption } from '../labeled-option';
import type { SortOrder } from './sort-stations';

export const SORT_ORDER_LABELS: Record<SortOrder, string> = {
  distance: 'Entfernung',
  price: 'Preis',
};

export const SORT_ORDER_OPTIONS: readonly LabeledOption<SortOrder>[] = [
  { value: 'distance', label: SORT_ORDER_LABELS.distance },
  { value: 'price', label: SORT_ORDER_LABELS.price },
];
