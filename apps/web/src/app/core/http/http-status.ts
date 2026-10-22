/** Status codes the app reacts to. The Worker keeps its own, since it is bundled on its own. */
export const HTTP_STATUS = {
  /** Angular reports a request that got no response at all (offline, CORS, aborted) as status 0. */
  networkFailure: 0,
  notFound: 404,
  tooManyRequests: 429,
  badGateway: 502,
  serviceUnavailable: 503,
  gatewayTimeout: 504,
} as const;
