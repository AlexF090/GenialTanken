import { z } from 'zod';
import { MOCK_UPSTREAM_PORT, UNEXPECTED_REQUESTS_PATH } from './mock-upstream-endpoints.js';

const unexpectedUpstreamRequestsSchema = z.array(z.string());

/**
 * Fails the run when the API sent the mock upstream a request it does not know (see
 * `mock-upstream.ts`). The mock serves every test at once, so under `fullyParallel` a request
 * cannot be attributed to a single test; the check runs once for the whole run instead.
 */
const assertNoUnexpectedUpstreamRequests = async (): Promise<void> => {
  const response = await fetch(
    `http://localhost:${String(MOCK_UPSTREAM_PORT)}${UNEXPECTED_REQUESTS_PATH}`
  );
  if (!response.ok) {
    throw new Error(
      `Could not read the unexpected requests of the mock upstream: HTTP ${String(response.status)}`
    );
  }
  const unexpectedRequests = unexpectedUpstreamRequestsSchema.parse(await response.json());
  if (unexpectedRequests.length > 0) {
    throw new Error(
      [
        'Every request of the API to an upstream must be mocked. The mock upstream received:',
        ...unexpectedRequests.map(request => `  ${request}`),
      ].join('\n')
    );
  }
};

export default assertNoUnexpectedUpstreamRequests;
