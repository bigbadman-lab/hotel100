import { hotelConfigFromEnv } from "@hotel100/config";
import { Pool } from "pg";
import type { Hex } from "viem";
import { createRoomServiceReader } from "./chain";
import { EntitlementError } from "./errors";
import type { EntitlementDeps } from "./handlers";
import type { SqlExecutor } from "./sql";
import { transportModeFromEnv } from "./transport";

/**
 * Production entitlement runtime.
 * DATABASE_URL is required. There is no in-memory store fallback.
 * The signer private key is read from the process environment only and is not logged.
 */
export function loadEntitlementDeps(env: Record<string, string | undefined>): EntitlementDeps {
  const databaseUrl = requireDatabaseUrl(env.DATABASE_URL);
  const config = hotelConfigFromEnv(env);
  const privateKey = readSignerKey(env.HOTEL_ENTITLEMENT_SIGNER_PRIVATE_KEY);

  return {
    sql: createPgSqlExecutor(databaseUrl),
    now: () => new Date(),
    domain: config.domain,
    roomServiceAddress: config.roomServiceAddress,
    entitlementSignerAddress: config.entitlementSignerAddress,
    entitlementSignerPrivateKey: privateKey,
    workerWriterAddress: config.workerWriterAddress,
    deployerOwnerAddress: config.deployerOwnerAddress,
    chain:
      config.rpcUrl && config.roomServiceAddress
        ? createRoomServiceReader({
            rpcUrl: config.rpcUrl,
            roomServiceAddress: config.roomServiceAddress,
          })
        : undefined,
    transportMode: transportModeFromEnv(env.NODE_ENV),
  };
}

export function requireDatabaseUrl(databaseUrl: string | undefined): string {
  const url = databaseUrl?.trim() ?? "";
  if (!url) {
    throw new EntitlementError("database_unconfigured", 503);
  }
  return url;
}

const executors = new Map<string, SqlExecutor>();

export function createPgSqlExecutor(databaseUrl: string): SqlExecutor {
  const url = requireDatabaseUrl(databaseUrl);
  const existing = executors.get(url);
  if (existing) return existing;
  const pool = new Pool({ connectionString: url, max: 4 });
  const executor: SqlExecutor = {
    async query<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
      const result = await pool.query(sql, params);
      return { rows: result.rows as T[] };
    },
  };
  executors.set(url, executor);
  return executor;
}

function readSignerKey(value: string | undefined): Hex | undefined {
  if (value === undefined) return undefined;
  const trimmed = value.trim();
  if (trimmed === "") return undefined;
  if (!/^0x[0-9a-fA-F]{64}$/.test(trimmed)) {
    throw new EntitlementError("entitlement_signer_unconfigured", 503);
  }
  return trimmed as Hex;
}
