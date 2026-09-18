import { type Address, HOTEL_CHAIN_ID, normalizeAddress } from "@hotel100/domain";

export const CHALLENGE_STATEMENT = "Claim HOTEL Room Service entitlement.";
export const CHALLENGE_VERSION = "1";
const HEADER_SUFFIX = " wants you to sign in with your Ethereum account:";

export type ParsedChallenge = {
  domain: string;
  wallet: Address;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
};

export function assertConfiguredDomain(domain: string | undefined): string {
  if (domain === undefined) {
    throw new Error("domain_unconfigured");
  }
  const trimmed = domain.trim();
  if (
    trimmed.length === 0 ||
    trimmed.length > 253 ||
    /[\s\\]/.test(trimmed) ||
    trimmed.includes("/")
  ) {
    throw new Error("domain_unconfigured");
  }
  return trimmed;
}

export function challengeUri(domain: string): string {
  return `https://${domain}`;
}

export function buildChallengeMessage(input: {
  domain: string;
  wallet: Address;
  nonce: string;
  chainId: number;
  issuedAt: string;
  expirationTime: string;
}): string {
  const wallet = normalizeAddress(input.wallet);
  return [
    `${input.domain}${HEADER_SUFFIX}`,
    wallet,
    "",
    CHALLENGE_STATEMENT,
    "",
    `URI: ${challengeUri(input.domain)}`,
    `Version: ${CHALLENGE_VERSION}`,
    `Chain ID: ${input.chainId}`,
    `Nonce: ${input.nonce}`,
    `Issued At: ${input.issuedAt}`,
    `Expiration Time: ${input.expirationTime}`,
  ].join("\n");
}

export function parseChallengeMessage(message: string): ParsedChallenge | null {
  if (message.length === 0 || message.length > 2048) return null;
  const lines = message.split("\n");
  if (lines.length !== 11) return null;

  const header = lines[0];
  const walletLine = lines[1];
  if (!header?.endsWith(HEADER_SUFFIX) || walletLine === undefined) return null;
  if (lines[2] !== "" || lines[3] !== CHALLENGE_STATEMENT || lines[4] !== "") return null;

  const domain = header.slice(0, header.length - HEADER_SUFFIX.length);
  if (domain.length === 0 || domain !== domain.trim()) return null;

  const uri = readPrefixed(lines[5], "URI: ");
  const version = readPrefixed(lines[6], "Version: ");
  const chainRaw = readPrefixed(lines[7], "Chain ID: ");
  const nonce = readPrefixed(lines[8], "Nonce: ");
  const issuedAt = readPrefixed(lines[9], "Issued At: ");
  const expirationTime = readPrefixed(lines[10], "Expiration Time: ");
  if (!uri || !version || !chainRaw || !nonce || !issuedAt || !expirationTime) return null;
  if (!/^[0-9a-f]{32}$/.test(nonce)) return null;
  if (!/^\d+$/.test(chainRaw)) return null;

  try {
    const wallet = normalizeAddress(walletLine);
    if (walletLine !== wallet) return null;
    return {
      domain,
      wallet,
      uri,
      version,
      chainId: Number(chainRaw),
      nonce,
      issuedAt,
      expirationTime,
    };
  } catch {
    return null;
  }
}

export function isoInstant(value: string | Date): string | null {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function messageMatchesIssuedChallenge(
  message: string,
  row: {
    domain: string;
    wallet: string;
    nonce: string;
    createdAt: string | Date;
    expiresAt: string | Date;
  },
): boolean {
  const issuedAt = isoInstant(row.createdAt);
  const expirationTime = isoInstant(row.expiresAt);
  if (!issuedAt || !expirationTime) return false;
  let wallet: Address;
  try {
    wallet = normalizeAddress(row.wallet);
  } catch {
    return false;
  }
  const expected = buildChallengeMessage({
    domain: row.domain,
    wallet,
    nonce: row.nonce,
    chainId: HOTEL_CHAIN_ID,
    issuedAt,
    expirationTime,
  });
  return expected === message;
}

function readPrefixed(line: string | undefined, prefix: string): string | null {
  if (!line?.startsWith(prefix)) return null;
  const value = line.slice(prefix.length);
  return value.length > 0 ? value : null;
}
