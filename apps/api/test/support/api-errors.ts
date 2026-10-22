import { apiErrorSchema } from '@genialtanken/contracts';

/** Error bodies must not carry more than the contract, e.g. no stack or Nest error name. */
export const strictApiErrorSchema = apiErrorSchema.strict();
