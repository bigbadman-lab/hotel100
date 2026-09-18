/** Challenge-authenticated entitlement responses must not be shared or CDN-cached. */
export const ENTITLEMENT_CACHE_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  Pragma: "no-cache",
} as const;

export function entitlementJson(status: number, body: unknown): Response {
  return Response.json(body, {
    status,
    headers: ENTITLEMENT_CACHE_HEADERS,
  });
}
