import {
  type Address,
  ENTITLEMENT_CHALLENGE_TTL_SECONDS,
  HOTEL_CHAIN_ID,
  normalizeAddress,
} from "@hotel100/domain";
import type { Hex } from "viem";
import { recoverMessageAddress } from "viem";
import type { RoomServiceChainReader } from "./chain";
import { entitlementDeadline, type RoomServiceClaimMessage, signRoomServiceClaim } from "./eip712";
import { EntitlementError } from "./errors";
import { entitlementJson } from "./headers";
import { clientIp, defaultRateLimits, ipBucket, type RateLimits, walletBucket } from "./rate-limit";
import { reconcileClaimable } from "./reconcile";
import {
  assertConfiguredDomain,
  buildChallengeMessage,
  CHALLENGE_VERSION,
  challengeUri,
  messageMatchesIssuedChallenge,
  parseChallengeMessage,
} from "./siwe";
import type { SqlExecutor } from "./sql";
import {
  consumeAuthNonce,
  findAuthNonce,
  insertAuthNonce,
  readFinalizedEarnedWei,
  readIndexedClaimCumulativeWei,
  takeRateLimit,
} from "./store";
import {
  effectiveProtocol,
  entitlementTransportAllowed,
  requestHostname,
  type TransportMode,
} from "./transport";

export type EntitlementDeps = {
  sql: SqlExecutor;
  now: () => Date;
  domain: string | undefined;
  roomServiceAddress: Address | undefined;
  entitlementSignerAddress: Address | undefined;
  /** Runtime secret only. Never log, return, or persist. */
  entitlementSignerPrivateKey: Hex | undefined;
  workerWriterAddress?: Address;
  deployerOwnerAddress?: Address;
  chain: RoomServiceChainReader | undefined;
  transportMode: TransportMode;
  rateLimits?: RateLimits;
  signClaim?: typeof signRoomServiceClaim;
};

export async function handleCreateChallenge(
  request: Request,
  deps: EntitlementDeps,
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
  const expiresAt = new Date(issuedAt.getTime() + ENTITLEMENT_CHALLENGE_TTL_SECONDS * 1000);
  const { nonce } = await insertAuthNonce(deps.sql, { wallet, domain, issuedAt, expiresAt });
  const message = buildChallengeMessage({
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

export async function handleEntitlement(
  request: Request,
  deps: EntitlementDeps,
): Promise<Response> {
  const denied = rejectTransport(request, deps);
  if (denied) return denied;

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

  const parsed = parseChallengeMessage(message);
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
    parsed.version !== CHALLENGE_VERSION
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
  const signerAddress = deps.entitlementSignerAddress;
  const privateKey = deps.entitlementSignerPrivateKey;
  const roomService = deps.roomServiceAddress;
  if (!chain || !signerAddress || !privateKey || !roomService) {
    return entitlementJson(503, { error: "entitlement_signer_unconfigured" });
  }

  let earned: bigint;
  let indexedClaim: bigint;
  let onchainClaimed: bigint;
  let signerEpoch: bigint;
  let onchainSigner: Address;
  try {
    [earned, indexedClaim, onchainClaimed, signerEpoch, onchainSigner] = await Promise.all([
      readFinalizedEarnedWei(deps.sql, recovered),
      readIndexedClaimCumulativeWei(deps.sql, recovered),
      chain.roomServiceClaimed(recovered),
      chain.signerEpoch(),
      chain.entitlementSigner(),
    ]);
  } catch {
    return entitlementJson(503, { error: "chain_read_failed" });
  }

  if (onchainSigner !== normalizeAddress(signerAddress)) {
    return entitlementJson(409, { error: "signer_mismatch" });
  }
  if (signerEpoch <= 0n) {
    return entitlementJson(409, { error: "entitlement_inconsistent" });
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

  let reconciled: { cumulativeWei: bigint; claimableWei: bigint };
  try {
    reconciled = reconcileClaimable({
      dbEarnedWei: earned,
      indexedClaimCumulativeWei: indexedClaim,
      onchainClaimedWei: onchainClaimed,
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return entitlementJson(error.status, { error: error.code });
    }
    return entitlementJson(409, { error: "entitlement_inconsistent" });
  }

  const base = {
    guest: recovered,
    chainId: HOTEL_CHAIN_ID,
    verifyingContract: roomService,
    cumulativeFinalizedEarnedWei: reconciled.cumulativeWei.toString(),
    alreadyClaimedWei: onchainClaimed.toString(),
    claimableDeltaWei: reconciled.claimableWei.toString(),
    signerEpoch: signerEpoch.toString(),
  };

  if (reconciled.claimableWei === 0n) {
    return entitlementJson(200, {
      ...base,
      deadline: null,
      signature: null,
    });
  }

  if (reconciled.cumulativeWei < onchainClaimed) {
    return entitlementJson(409, { error: "entitlement_inconsistent" });
  }

  const deadline = entitlementDeadline(deps.now());
  const claim: RoomServiceClaimMessage = {
    guest: recovered,
    cumulativeEntitlement: reconciled.cumulativeWei,
    deadline,
    signerEpoch,
  };
  const sign = deps.signClaim ?? signRoomServiceClaim;
  try {
    const claimSignature = await sign({
      privateKey,
      expectedSigner: signerAddress,
      forbiddenSigners: forbiddenSigners(deps),
      verifyingContract: roomService,
      message: claim,
    });
    return entitlementJson(200, {
      ...base,
      deadline: deadline.toString(),
      signature: claimSignature,
    });
  } catch (error) {
    if (error instanceof EntitlementError) {
      return entitlementJson(error.status, { error: error.code });
    }
    return entitlementJson(503, { error: "entitlement_sign_failed" });
  }
}

function rejectTransport(request: Request, deps: EntitlementDeps): Response | null {
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
  deps: EntitlementDeps,
  wallet: Address,
): Promise<Response | null> {
  const limits = deps.rateLimits ?? defaultRateLimits();
  const now = deps.now();
  const walletOk = await takeRateLimit(deps.sql, {
    bucketKey: walletBucket(wallet),
    now,
    windowSeconds: limits.windowSeconds,
    max: limits.walletMax,
  });
  const ipOk = await takeRateLimit(deps.sql, {
    bucketKey: ipBucket(clientIp(request)),
    now,
    windowSeconds: limits.windowSeconds,
    max: limits.ipMax,
  });
  if (!walletOk) return entitlementJson(429, { error: "rate_limited", scope: "wallet" });
  if (!ipOk) return entitlementJson(429, { error: "rate_limited", scope: "ip" });
  return null;
}

function forbiddenSigners(deps: EntitlementDeps): Address[] {
  const forbidden: Address[] = [];
  if (deps.workerWriterAddress) forbidden.push(deps.workerWriterAddress);
  if (deps.deployerOwnerAddress) forbidden.push(deps.deployerOwnerAddress);
  return forbidden;
}
