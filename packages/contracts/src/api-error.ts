import * as z from 'zod';

/** Error body of every non-2xx API response. */
export const apiErrorSchema = z.object({
  statusCode: z.number().int(),
  message: z.string(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;
