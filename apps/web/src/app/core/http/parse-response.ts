import { UnexpectedResponseError } from './unexpected-response-error';

interface SafeParseSuccess<Output> {
  success: true;
  data: Output;
}

interface SafeParseFailure {
  success: false;
  error: { message: string };
}

/**
 * Structural view of a zod 4 schema's `safeParse`. The web app has no direct zod dependency, so the
 * contracts' schemas are accepted by shape instead of as `ZodType`.
 */
export interface SafeParser<Output> {
  safeParse(input: unknown): SafeParseSuccess<Output> | SafeParseFailure;
}

/** Validates a response body against the shared contract; throws {@link UnexpectedResponseError}. */
export const parseResponse = <Output>(
  schema: SafeParser<Output>,
  body: unknown,
  endpoint: string
): Output => {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new UnexpectedResponseError(endpoint, result.error.message);
  }
  return result.data;
};
