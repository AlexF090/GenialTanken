/** Plain http is only allowed for a local API during `wrangler dev`. */
const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '[::1]']);

/** Whether `API_ORIGIN` may be called: https, or http for a local API only. */
export const isAllowedApiOrigin = (value: string | undefined): value is string => {
  if (value === undefined || !URL.canParse(value)) {
    return false;
  }
  const { protocol, hostname } = new URL(value);
  return protocol === 'https:' || (protocol === 'http:' && LOCAL_HOSTNAMES.has(hostname));
};
