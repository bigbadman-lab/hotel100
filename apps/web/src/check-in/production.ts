import { hotelConfigFromEnv } from "@hotel100/config";
import type { Hex } from "viem";
import { EntitlementError } from "../entitlement/errors";
import { createPgSqlExecutor, requireDatabaseUrl } from "../entitlement/production";
import { transportModeFromEnv } from "../entitlement/transport";
import { createCheckInChainReader } from "./chain";
import type { CheckInDeps } from "./handlers";

/**
 * Production check-in eligibility runtime.
 * Uses HOTEL_ELIGIBILITY_SIGNER_PRIVATE_KEY only — never the entitlement signer key.
 */
export function loadCheckInDeps(env: Record<string, string | undefined>): CheckInDeps {
  const databaseUrl = requireDatabaseUrl(env.DATABASE_URL);
  const config = hotelConfigFromEnv(env);
  const privateKey = readSignerKey(env.HOTEL_ELIGIBILITY_SIGNER_PRIVATE_KEY);
  const entitlementKey = env.HOTEL_ENTITLEMENT_SIGNER_PRIVATE_KEY?.trim();
  if (privateKey && entitlementKey && entitlementKey.toLowerCase() === privateKey.toLowerCase()) {
    throw new EntitlementError("eligibility_signer_forbidden", 503);
  }

  return {
    sql: createPgSqlExecutor(databaseUrl),
    now: () => new Date(),
    domain: config.domain,
    hotelCheckInEnabled: config.hotelCheckInEnabled,
    roomServiceAddress: config.roomServiceAddress,
    eligibilitySignerAddress: config.eligibilitySignerAddress,
    eligibilitySignerPrivateKey: privateKey,
    entitlementSignerAddress: config.entitlementSignerAddress,
    workerWriterAddress: config.workerWriterAddress,
    deployerOwnerAddress: config.deployerOwnerAddress,
    chain:
      config.rpcUrl && config.roomServiceAddress
        ? createCheckInChainReader({
            rpcUrl: config.rpcUrl,
            roomServiceAddress: config.roomServiceAddress,
          })
        : undefined,
    transportMode: transportModeFromEnv(env.NODE_ENV),
  };
}

function readSignerKey(value: string | undefined): Hex | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new EntitlementError("eligibility_signer_unconfigured", 503);
  }
  return trimmed as Hex;
}
