/** Shared between the mock upstream server and the test fixture (importing the server would start it). */
export const MOCK_UPSTREAM_PORT = Number(process.env.E2E_MOCK_UPSTREAM_PORT ?? 4110);

export const UNEXPECTED_REQUESTS_PATH = '/__mock/unexpected-requests';
