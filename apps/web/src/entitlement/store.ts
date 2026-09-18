import { randomBytes } from "node:crypto";
import { type Address, HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";
import type { SqlExecutor } from "./sql.js";

export type AuthNonceRow = {
  wallet_address: string;
  nonce: string;
  domain: string;
  chain_id: number | string;
  created_ms: string | number;
  expires_ms: string | number;
  consumed_at: string | Date | null;
};

export async function insertAuthNonce(
  sql: SqlExecutor,
  args: { wallet: Address; domain: string; issuedAt: Date; expiresAt: Date },
): Promise<{ nonce: string }> {
  const nonce = randomBytes(16).toString("hex");
  await sql.query(
    `INSERT INTO auth_nonces (wallet_address, nonce, domain, chain_id, expires_at, created_at)
     VALUES ($1, $2, $3, 4663, $4::timestamptz, $5::timestamptz)`,
    [args.wallet, nonce, args.domain, args.expiresAt.toISOString(), args.issuedAt.toISOString()],
  );
  return { nonce };
}

export async function findAuthNonce(sql: SqlExecutor, nonce: string): Promise<AuthNonceRow | null> {
  const { rows } = await sql.query<AuthNonceRow>(
    `SELECT wallet_address, nonce, domain, chain_id,
            ROUND(EXTRACT(EPOCH FROM created_at) * 1000)::bigint::text AS created_ms,
            ROUND(EXTRACT(EPOCH FROM expires_at) * 1000)::bigint::text AS expires_ms,
            consumed_at
     FROM auth_nonces
     WHERE nonce = $1`,
    [nonce],
  );
  return rows[0] ?? null;
}

/**
 * Atomic single-use consume. A second concurrent caller updates zero rows.
 * Wrong wallet, domain, chain, or expiry does not consume this or any other nonce.
 */
export async function consumeAuthNonce(
  sql: SqlExecutor,
  args: { nonce: string; wallet: Address; domain: string; now: Date },
): Promise<boolean> {
  const { rows } = await sql.query<{ nonce: string }>(
    `UPDATE auth_nonces
     SET consumed_at = $4::timestamptz
     WHERE nonce = $1
       AND wallet_address = $2
       AND domain = $3
       AND chain_id = $5
       AND consumed_at IS NULL
       AND expires_at > $4::timestamptz
     RETURNING nonce`,
    [
      args.nonce,
      normalizeAddress(args.wallet),
      args.domain,
      args.now.toISOString(),
      HOTEL_CHAIN_ID,
    ],
  );
  return rows.length === 1;
}

export async function takeRateLimit(
  sql: SqlExecutor,
  args: { bucketKey: string; now: Date; windowSeconds: number; max: number },
): Promise<boolean> {
  const { rows } = await sql.query<{ hit_count: number | string }>(
    `INSERT INTO entitlement_rate_limits (bucket_key, window_start, hit_count, updated_at)
     VALUES ($1, $2::timestamptz, 1, $2::timestamptz)
     ON CONFLICT (bucket_key) DO UPDATE
     SET
       hit_count = CASE
         WHEN entitlement_rate_limits.window_start <= ($2::timestamptz - make_interval(secs => $3::int))
         THEN 1
         ELSE entitlement_rate_limits.hit_count + 1
       END,
       window_start = CASE
         WHEN entitlement_rate_limits.window_start <= ($2::timestamptz - make_interval(secs => $3::int))
         THEN $2::timestamptz
         ELSE entitlement_rate_limits.window_start
       END,
       updated_at = $2::timestamptz
     RETURNING hit_count`,
    [args.bucketKey, args.now.toISOString(), args.windowSeconds],
  );
  const hit = Number(rows[0]?.hit_count ?? 0);
  return hit <= args.max;
}

export async function readFinalizedEarnedWei(sql: SqlExecutor, guest: Address): Promise<bigint> {
  const { rows } = await sql.query<{ earned: string | null }>(
    `SELECT cumulative_earned_wei::text AS earned
     FROM guest_entitlements
     WHERE guest_address = $1`,
    [guest],
  );
  return parseWei(rows[0]?.earned);
}

export async function readIndexedClaimCumulativeWei(
  sql: SqlExecutor,
  guest: Address,
): Promise<bigint> {
  const { rows } = await sql.query<{ claimed: string | null }>(
    `SELECT COALESCE(MAX(cumulative_entitlement_wei), 0)::text AS claimed
     FROM room_service_claims
     WHERE guest_address = $1`,
    [guest],
  );
  return parseWei(rows[0]?.claimed);
}

function parseWei(value: string | null | undefined): bigint {
  if (value === null || value === undefined || value === "") return 0n;
  if (!/^\d+$/.test(value)) {
    throw new Error("accounting_inconsistent");
  }
  return BigInt(value);
}
