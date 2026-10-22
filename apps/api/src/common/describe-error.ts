/** Text for the log: the stack of an error, which starts with its name and message. */
export const describeError = (reason: unknown): string =>
  reason instanceof Error ? (reason.stack ?? String(reason)) : String(reason);
