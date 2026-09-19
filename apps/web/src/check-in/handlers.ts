import { randomBytes } from "node:crypto";
import {
  type Address,
  BURN_ADDRESSES,
  CHECK_IN_CHALLENGE_TTL_SECONDS,
  checkInMinimum,
  effectiveHotelBalance,
  HOTEL_CHAIN_ID,
  HOTEL_ROOM_COUNT,
  holdersWithEffectiveEscrowBalance,
  isTopHundredRank,
  normalizeAddress,
  rankEligibleHolders,
  ZERO_ADDRESS,
} from "@hotel100/domain";
import type { Hex } from "viem";
import { recoverMessageAddress } from "viem";
import { EntitlementError } from "../entitlement/errors";
import { entitlementJson } from "../entitlement/headers";
import {
  clientIp,
  defaultRateLimits,
  ipBucket,
  type RateLimits,
  walletBucket,
} from "../entitlement/rate-limit";
import type { SqlExecutor } from "../entitlement/sql";
import {
  consumeAuthNonce,
  findAuthNonce,
  insertAuthNonce,
  takeRateLimit,
} from "../entitlement/store";
import {
  effectiveProtocol,
  entitlementTransportAllowed,
  requestHostname,
  type TransportMode,
} from "../entitlement/transport";
import { type CheckInChainReader, isEmptyCode } from "./chain";
import {
  type CheckInAuthorizationMessage,
  checkInAuthDeadline,
  signCheckInAuthorization,
} from "./eip712";
import {
  assertConfiguredDomain,
  buildCheckInChallengeMessage,
  CHECK_IN_CHALLENGE_VERSION,
  challengeUri,
  messageMatchesIssuedChallenge,
  parseCheckInChallengeMessage,
} from "./siwe";

export type CheckInDeps = {
  sql: SqlExecutor;
  now: () => Date;
  domain: string | undefined;
  hotelCheckInEnabled: boolean;
  roomServiceAddress: Address | undefined;
  eligibilitySignerAddress: Address | undefined;
  /** Runtime secret only. Never log, return, or persist. Never reuse entitlement key. */
  eligibilitySignerPrivateKey: Hex | undefined;
  entitlementSignerAddress?: Address;
  workerWriterAddress?: Address;
  deployerOwnerAddress?: Address;
  chain: CheckInChainReader | undefined;
  transportMode: TransportMode;
  rateLimits?: RateLimits;
  signAuthorization?: typeof signCheckInAuthorization;
};

export async function handleCheckInChallenge(
  request: Request,
  deps: CheckInDeps,
): Promise<Response> {
  const denied = rejectTransport(request, deps);
  if (denied) return denied;

  let wallet: Address;
  try {
    const body = (await request.json()) as { wallet?: string };
    wallet = normalizeAddress(body.wallet ?? "");
  } catch {
    return entitlementJson(400, { error: "invalid_wallet" });
  }

  const limited = await enforceRateLimits(request, deps, wallet);
  if (limited) return limited;

  let domain: string;
  try {
    domain = assertConfiguredDomain(deps.domain);
  } catch {
    return entitlementJson(503, { error: "domain_unconfigured" });
  }

  const issuedAt = deps.now();
  const expiresAt = new Date(issuedAt.getTime() + CHECK_IN_CHALLENGE_TTL_SECONDS * 1000);
  const { nonce } = await insertAuthNonce(deps.sql, { wallet, domain, issuedAt, expiresAt });
  const message = buildCheckInChallengeMessage({
    domain,
    wallet,
    nonce,
    chainId: HOTEL_CHAIN_ID,
    issuedAt: issuedAt.toISOString(),
    expirationTime: expiresAt.toISOString(),
  });

  return entitlementJson(200, {
    wallet,
    domain,
    chainId: HOTEL_CHAIN_ID,
    nonce,
    message,
    issuedAt: issuedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
  });
}

export async function handleCheckInAuthorize(
  request: Request,
  deps: CheckInDeps,
): Promise<Response> {
  const denied = rejectTransport(request, deps);
  if (denied) return denied;

  if (!deps.hotelCheckInEnabled) {
    return entitlementJson(503, { error: "check_in_disabled" });
  }

  let message = "";
  let signature: Hex;
  try {
    const body = (await request.json()) as { message?: string; signature?: string };
    message = typeof body.message === "string" ? body.message : "";
    const sig = body.signature ?? "";
    if (!/^0x[0-9a-fA-F]{130}$/.test(sig)) {
      return entitlementJson(401, { error: "invalid_signature" });
    }
    signature = sig as Hex;
  } catch {
    return entitlementJson(400, { error: "invalid_request" });
  }

  const parsed = parseCheckInChallengeMessage(message);
  if (!parsed) {
    return entitlementJson(401, { error: "invalid_challenge" });
  }

  const limited = await enforceRateLimits(request, deps, parsed.wallet);
  if (limited) return limited;

  let domain: string;
  try {
    domain = assertConfiguredDomain(deps.domain);
  } catch {
    return entitlementJson(503, { error: "domain_unconfigured" });
  }

  if (
    parsed.domain !== domain ||
    parsed.uri !== challengeUri(domain) ||
    parsed.version !== CHECK_IN_CHALLENGE_VERSION
  ) {
    return entitlementJson(401, { error: "wrong_domain" });
  }
  if (parsed.chainId !== HOTEL_CHAIN_ID) {
    return entitlementJson(401, { error: "wrong_chain" });
  }

  let recovered: Address;
  try {
    recovered = normalizeAddress(await recoverMessageAddress({ message, signature }));
  } catch {
    return entitlementJson(401, { error: "invalid_signature" });
  }
  if (recovered !== parsed.wallet) {
    return entitlementJson(401, { error: "wrong_wallet" });
  }

  const row = await findAuthNonce(deps.sql, parsed.nonce);
  if (
    !row ||
    !messageMatchesIssuedChallenge(message, {
      domain: row.domain,
      wallet: row.wallet_address,
      nonce: row.nonce,
      createdAt: new Date(Number(row.created_ms)),
      expiresAt: new Date(Number(row.expires_ms)),
    })
  ) {
    return entitlementJson(401, { error: "challenge_mismatch" });
  }
  if (
    normalizeAddress(row.wallet_address) !== recovered ||
    row.domain !== domain ||
    Number(row.chain_id) !== HOTEL_CHAIN_ID
  ) {
    return entitlementJson(401, { error: "challenge_mismatch" });
  }

  const chain = deps.chain;
  const signerAddress = deps.eligibilitySignerAddress;
  const privateKey = deps.eligibilitySignerPrivateKey;
  const roomService = deps.roomServiceAddress;
  if (!chain || !signerAddress || !privateKey || !roomService) {
    return entitlementJson(503, { error: "eligibility_signer_unconfigured" });
  }

  let onchainSigner: Address;
  let signerEpoch: bigint;
  let hasStay: boolean;
  let code: string;
  try {
    [onchainSigner, signerEpoch, hasStay, code] = await Promise.all([
      chain.eligibilitySigner(),
      chain.eligibilitySignerEpoch(),
      chain.hasUnwithdrawnStay(recovered),
      chain.getCode(recovered),
    ]);
  } catch {
    return entitlementJson(503, { error: "chain_read_failed" });
  }

  if (onchainSigner !== normalizeAddress(signerAddress)) {
    return entitlementJson(409, { error: "signer_mismatch" });
  }
  if (signerEpoch <= 0n) {
    return entitlementJson(409, { error: "check_in_inconsistent" });
  }
  if (!isEmptyCode(code)) {
    return entitlementJson(403, { error: "not_eoa" });
  }
  if (hasStay) {
    return entitlementJson(409, { error: "already_checked_in" });
  }

  const ranking = await loadEffectiveRanking(deps.sql, roomService);
  const holder = ranking.find((h) => h.address === recovered);
  if (!holder || !isTopHundredRank(holder.rank)) {
    return entitlementJson(403, { error: "not_top_100" });
  }

  const walletHeld = await readWalletHeld(deps.sql, recovered);
  const escrow = await readUnwithdrawnEscrow(deps.sql, recovered);
  if (escrow > 0n) {
    return entitlementJson(409, { error: "already_checked_in" });
  }
  const effective = effectiveHotelBalance(walletHeld, escrow);
  const minAmount = checkInMinimum(effective);
  const maxAmount = walletHeld;
  if (maxAmount < minAmount || maxAmount === 0n) {
    return entitlementJson(403, { error: "insufficient_wallet_balance" });
  }

  const consumed = await consumeAuthNonce(deps.sql, {
    nonce: parsed.nonce,
    wallet: recovered,
    domain,
    now: deps.now(),
  });
  if (!consumed) {
    return entitlementJson(401, { error: "challenge_not_consumable" });
  }

  const deadline = checkInAuthDeadline(deps.now());
  const nonce = randomAuthorizationNonce();
  const auth: CheckInAuthorizationMessage = {
    guest: recovered,
    minAmount,
    maxAmount,
    deadline,
    nonce,
    signerEpoch,
  };
  const sign = deps.signAuthorization ?? signCheckInAuthorization;
  try {
    const authSignature = await sign({
      privateKey,
      expectedSigner: signerAddress,
      forbiddenSigners: forbiddenSigners(deps),
      verifyingContract: roomService,
      message: auth,
    });
    return entitlementJson(200, {
      guest: recovered,
      chainId: HOTEL_CHAIN_ID,
      verifyingContract: roomService,
      minAmount: minAmount.toString(),
      maxAmount: maxAmount.toString(),
      deadline: deadline.toString(),
      nonce: nonce.toString(),
      signerEpoch: signerEpoch.toString(),
      signature: authSignature,
      effectiveBalanceRaw: effective.toString(),
      walletHeldRaw: walletHeld.toString(),
      rank: holder.rank,
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return entitlementJson(error.status, { error: error.code });
    }
    return entitlementJson(503, { error: "eligibility_sign_failed" });
  }
}

async function loadEffectiveRanking(sql: SqlExecutor, roomService: Address) {
  const [holders, excluded, escrows] = await Promise.all([
    sql.query<{ address: string; balance_raw: string }>(
      `SELECT address, balance_raw::text AS balance_raw FROM holders WHERE balance_raw > 0`,
    ),
    sql.query<{ address: string }>(`SELECT address FROM excluded_addresses`),
    sql.query<{ guest_address: string; amount_raw: string }>(
      `SELECT guest_address, amount_raw::text AS amount_raw
       FROM check_in_positions WHERE withdrawn_at IS NULL`,
    ),
  ]);
  const blocked = new Set<string>([...BURN_ADDRESSES, ZERO_ADDRESS, normalizeAddress(roomService)]);
  for (const row of excluded.rows) blocked.add(normalizeAddress(row.address));
  const withEffective = holdersWithEffectiveEscrowBalance({
    walletHolders: holders.rows.map((row) => ({
      address: normalizeAddress(row.address),
      balanceRaw: BigInt(row.balance_raw),
    })),
    escrows: escrows.rows.map((row) => ({
      guestAddress: normalizeAddress(row.guest_address),
      amountRaw: BigInt(row.amount_raw),
      checkInTimestamp: 0,
      unlockTimestamp: 0,
    })),
    excludedAddresses: blocked,
  });
  return rankEligibleHolders(withEffective).filter((h) => h.rank <= HOTEL_ROOM_COUNT);
}

async function readWalletHeld(sql: SqlExecutor, wallet: Address): Promise<bigint> {
  const { rows } = await sql.query<{ balance_raw: string }>(
    `SELECT balance_raw::text AS balance_raw FROM holders WHERE address = $1`,
    [wallet],
  );
  return rows[0] ? BigInt(rows[0].balance_raw) : 0n;
}

async function readUnwithdrawnEscrow(sql: SqlExecutor, wallet: Address): Promise<bigint> {
  const { rows } = await sql.query<{ amount_raw: string }>(
    `SELECT amount_raw::text AS amount_raw FROM check_in_positions
     WHERE guest_address = $1 AND withdrawn_at IS NULL`,
    [wallet],
  );
  return rows[0] ? BigInt(rows[0].amount_raw) : 0n;
}

function randomAuthorizationNonce(): bigint {
  const bytes = randomBytes(16);
  let hex = "0x";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return BigInt(hex);
}

function rejectTransport(request: Request, deps: CheckInDeps): Response | null {
  const allowed = entitlementTransportAllowed({
    mode: deps.transportMode,
    protocol: effectiveProtocol(request),
    hostname: requestHostname(request),
  });
  if (allowed) return null;
  return entitlementJson(403, { error: "https_required" });
}

async function enforceRateLimits(
  request: Request,
  deps: CheckInDeps,
  wallet: Address,
): Promise<Response | null> {
  const limits = deps.rateLimits ?? defaultRateLimits();
  const now = deps.now();
  const walletOk = await takeRateLimit(deps.sql, {
    bucketKey: `checkin:${walletBucket(wallet)}`,
    now,
    windowSeconds: limits.windowSeconds,
    max: limits.walletMax,
  });
  const ipOk = await takeRateLimit(deps.sql, {
    bucketKey: `checkin:${ipBucket(clientIp(request))}`,
    now,
    windowSeconds: limits.windowSeconds,
    max: limits.ipMax,
  });
  if (!walletOk) return entitlementJson(429, { error: "rate_limited", scope: "wallet" });
  if (!ipOk) return entitlementJson(429, { error: "rate_limited", scope: "ip" });
  return null;
}

function forbiddenSigners(deps: CheckInDeps): Address[] {
  const forbidden: Address[] = [];
  if (deps.workerWriterAddress) forbidden.push(deps.workerWriterAddress);
  if (deps.deployerOwnerAddress) forbidden.push(deps.deployerOwnerAddress);
  if (deps.entitlementSignerAddress) forbidden.push(deps.entitlementSignerAddress);
  return forbidden;
}
