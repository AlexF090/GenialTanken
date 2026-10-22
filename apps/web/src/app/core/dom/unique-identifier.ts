let nextNumber = 0;

/** An `id` unique within the page, e.g. to connect a control with its label or popup. */
export const uniqueIdentifier = (prefix: string): string => `${prefix}-${String(nextNumber++)}`;
