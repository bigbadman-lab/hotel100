export type TransportMode = "production" | "development";

export function transportModeFromEnv(nodeEnv: string | undefined): TransportMode {
  return nodeEnv === "production" ? "production" : "development";
}

export function isLocalDevelopmentHost(hostname: string): boolean {
  const host = hostname.trim().toLowerCase();
  return host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "[::1]";
}

/**
 * Production always requires HTTPS, including localhost.
 * Development allows HTTP only for localhost / loopback request URLs.
 */
export function entitlementTransportAllowed(args: {
  mode: TransportMode;
  protocol: string;
  hostname: string;
}): boolean {
  const protocol = args.protocol.replace(":", "").toLowerCase();
  if (args.mode === "production") {
    return protocol === "https";
  }
  if (protocol === "https") return true;
  return protocol === "http" && isLocalDevelopmentHost(args.hostname);
}

export function effectiveProtocol(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-proto");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim().toLowerCase();
    if (first) return first;
  }
  return new URL(request.url).protocol.replace(":", "").toLowerCase();
}

export function requestHostname(request: Request): string {
  return new URL(request.url).hostname;
}
