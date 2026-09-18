/** Light MVP abuse limits. Not a second service and not Redis. */
export const ENTITLEMENT_RATE_WINDOW_SECONDS = 60;
export const ENTITLEMENT_WALLET_RATE_MAX = 30;
export const ENTITLEMENT_IP_RATE_MAX = 120;

export type RateLimits = {
  windowSeconds: number;
  walletMax: number;
  ipMax: number;
};

export function defaultRateLimits(): RateLimits {
  return {
    windowSeconds: ENTITLEMENT_RATE_WINDOW_SECONDS,
    walletMax: ENTITLEMENT_WALLET_RATE_MAX,
    ipMax: ENTITLEMENT_IP_RATE_MAX,
  };
}

export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  const ip =
    first && first.length > 0 ? first : (request.headers.get("x-real-ip")?.trim() ?? "unknown");
  return ip.slice(0, 128);
}

export function walletBucket(wallet: string): string {
  return `wallet:${wallet}`;
}

export function ipBucket(ip: string): string {
  return `ip:${ip}`;
}
