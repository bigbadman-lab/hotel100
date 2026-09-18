# $HOTEL MVP — MASTER CURSOR IMPLEMENTATION PROMPT

## STATUS

**Specification state: FROZEN**

You are implementing the `$HOTEL` MVP from an already-reviewed and approved product + technical specification.

Your role is **implementation**, not product design.

Do **not** reopen, reinterpret, simplify, optimize away, or redesign frozen architecture, financial logic, security invariants, launch ordering, eligibility rules, accounting rules, deployment gates, or operational semantics unless repository reality proves a requirement is technically impossible or unsafe.

If a frozen invariant cannot be implemented safely as written:

**Verdict: BLOCKED**

Explain the exact conflict, cite the affected files/code paths, and stop before changing that invariant.

Do not silently redesign.

---


# 0.0 GREENFIELD REPOSITORY FACT

This is a **greenfield HOTEL build**.

There is no pre-existing HOTEL repository to preserve, migrate, or audit.

Therefore:

- create the repo from scratch;
- do not assume legacy HOTEL code exists;
- do not spend implementation time looking for prior HOTEL modules;
- do not import SCOOP architecture wholesale;
- SCOOP may be used only as conceptual/operator experience if the human explicitly supplies reusable interfaces, addresses, or code later;
- use the smallest architecture that satisfies this frozen HOTEL spec;
- keep external protocol integrations behind narrow typed interfaces;
- keep all unresolved production values configurable.

This greenfield fact changes repository setup only. It does **not** reopen any frozen HOTEL product, financial, security, or launch invariant.

---

# 0. NON-NEGOTIABLE CURSOR OPERATING RULES

These rules apply to the entire implementation.

## 0.1 Repository starting state

There is **no existing HOTEL repository** at the start of this task.

Your first responsibility is to create a new repository/workspace for HOTEL and establish a clean, minimal project structure that supports the frozen MVP specification.

Do not waste time searching for an existing HOTEL codebase.

Before substantive implementation:

1. confirm the working directory is appropriate for creating the new project;
2. initialize a new git repository for HOTEL;
3. create a minimal monorepo/workspace structure suitable for:
   - Solidity contracts;
   - web frontend;
   - one worker/indexer service;
   - shared TypeScript/domain logic;
   - Supabase/Postgres migrations and database functions;
   - deployment/simulation tooling;
   - audit reports;
4. choose standard, well-supported tooling only;
5. keep architecture intentionally small;
6. document all framework/tooling choices in the bootstrap audit;
7. identify all production configuration values that remain intentionally unresolved.

Do not create unnecessary services, packages, queues, Redis, or microservice boundaries.

The frozen product architecture is already decided. Repository/bootstrap choices must serve that architecture rather than redefine it.

---

## 0.2 Bootstrap audit first

Because there is no existing HOTEL repository, the first gate is a **repository bootstrap + implementation-plan audit**, not a read-only audit of existing code.

Before building product functionality:

1. initialize the repository;
2. establish the minimal project/workspace skeleton;
3. initialize package management/build tooling;
4. initialize Solidity tooling;
5. initialize test tooling;
6. initialize lint/typecheck formatting where appropriate;
7. create `.gitignore`;
8. create safe example environment/config files containing key names only, never secrets;
9. create the `audit/` directory;
10. record the chosen architecture and why it maps directly to the frozen specification.

The bootstrap audit must include:

- repository root path;
- branch;
- initial/bootstrap HEAD where applicable;
- working-tree state;
- package manager;
- runtime versions;
- Solidity framework;
- frontend framework;
- worker/indexer runtime;
- shared package/domain structure;
- Supabase/Postgres migration structure;
- test frameworks;
- deployment/simulation tooling structure;
- config strategy;
- unresolved production configuration inputs;
- proposed implementation phases;
- risk areas;
- explicit verdict.

Verdict must be exactly one of:

`PASS — REPOSITORY BOOTSTRAPPED; IMPLEMENTATION MAY BEGIN`

or

`BLOCKED — REPOSITORY BOOTSTRAP REQUIRES REVIEW`

Save as:

`audit/hotel-mvp-repository-bootstrap.md`

Do not proceed past a BLOCKED verdict.

---

## 0.3 Controlled implementation gates

Implement in controlled gates.

Each gate must:

1. inspect relevant existing code;
2. state intended scope;
3. make only scoped changes;
4. run relevant static checks/tests;
5. add tests for financial/security invariants;
6. record git state;
7. write a Markdown audit report;
8. conclude with explicit `PASS` or `BLOCKED`.

Never bundle unrelated architectural rewrites into a HOTEL gate.

---

## 0.4 Production safety

For every production write/broadcast path implemented:

**simulate → broadcast → verify receipt**

The code must support this sequence explicitly.

Do not perform irreversible production actions merely because tooling exists.

This task is an implementation task only.

### ABSOLUTE LAUNCH PROHIBITION

Do **not** perform the real `$HOTEL` production launch.

Do **not** broadcast:

- production Pons V2 HOTEL launch;
- production opening/dev buy;
- production HoodLock lock;
- production owner transfer;
- production signer rotation;
- production live activation;
- any irreversible production HOTEL deployment action.

Those belong to a later explicit launch gate.

Local tests, fork tests, deterministic address prediction, dry runs, simulations, and non-production fixtures are allowed.

If any script would broadcast by default, change it so production broadcast requires deliberate explicit confirmation.

---

## 0.5 PASS / BLOCKED semantics

All major implementation, deployment-preparation, config, and safety gates must end with exactly one of:

`PASS`

or

`BLOCKED`

Never use vague language such as:

- probably okay;
- seems fine;
- mostly complete;
- should work.

A gate is PASS only when its stated requirements are proven.

---

## 0.6 Secrets

Never:

- print private keys;
- print seed phrases;
- print secret API keys;
- commit secrets;
- dump complete environment files;
- place secrets in audit reports;
- echo signer credentials.

Safe reports may include:

- public wallet addresses;
- contract addresses;
- chain IDs;
- transaction hashes;
- block numbers;
- config key names;
- booleans indicating whether required config is present.

Use redaction where appropriate.

---

## 0.7 Audit trail

Every major build phase must create a Markdown completion/audit report.

Each report must include:

- UTC timestamp;
- branch;
- pre-HEAD;
- final HEAD if a commit is made;
- working-tree state;
- files changed;
- tests/checks run;
- commands run where safe;
- invariants verified;
- unresolved issues;
- production broadcasts performed: must state `NONE` unless explicitly authorized later;
- verdict: `PASS` or `BLOCKED`.

Do not delete or overwrite earlier HOTEL audit reports.

---

## 0.8 Completion report for ChatGPT

At the end of the implementation work, save a complete Markdown report suitable for download and upload back into ChatGPT.

Preferred path:

`audit/hotel-mvp-implementation-completion.md`

The report must summarize all gates, exact implementation status, remaining config inputs, test results, known limitations, production-readiness blockers, and the next recommended gate.

The report must explicitly confirm:

`REAL HOTEL PRODUCTION LAUNCH PERFORMED: NO`

---

# 1. CANONICAL PRODUCT

Product:

`$HOTEL`

Core line:

**100 rooms. No reservations.**

The top 100 eligible `$HOTEL` holders occupy a live virtual hotel.

Rank mapping:

- rank #1 = Penthouse;
- ranks #2–#100 = Rooms 2–100;
- rank #101+ = lobby.

Buying/selling changes rooms.

Every 15 minutes the current eligible top 100 receive **Room Service**, funded by `$HOTEL` creator revenue and split pure pro rata by `$HOTEL` snapshot balance.

Guests accumulate cumulative ETH entitlement and claim through `RoomService.sol`.

---

# 2. CANONICAL CHAIN + LAUNCH CONFIG

Chain:

`Robinhood Chain`

Chain ID:

`4663`

Launch system:

`Pons V2`

Pair:

`native ETH`

Creator tax:

`300 bps / 3%`

Creator-fee recipient:

`RoomService.sol`

Pons buyback:

`OFF for HOTEL V1`

Opening/dev buy:

`0.06 ETH`

Opening-buy max slippage:

`100 bps / 1%`

Opening-buy recipient:

`deployer EOA`

100% of opening/dev-buy `$HOTEL` tokens must then be locked through HoodLock.

Minimum HoodLock duration:

`7 * 24 hours`

Production lock target:

`latest chain timestamp + 604800 + 300 seconds`

Do not invent any missing production address, salt, RPC URL, token metadata, owner, signer, worker writer, deployer, domain, or other unresolved deployment value.

Treat them as configuration inputs.

---

# 3. CRITICAL DETERMINISTIC DEPLOYMENT ORDER

`RoomService.sol` must exist before `$HOTEL` launches because RoomService must be supplied to Pons V2 as `creatorFeeRecipient`.

`RoomService.sol` also stores immutable `hotelToken`.

Production deployment therefore requires deterministic Pons V2 token-address prediction.

Implement production-safe tooling for this exact sequence:

1. freeze launch config;
2. freeze salt;
3. predict `$HOTEL` token address;
4. deploy `RoomService.sol` with predicted `$HOTEL` address;
5. verify RoomService deployment;
6. launch `$HOTEL`;
7. require actual token address == predicted token address;
8. mismatch = `BLOCKED`.

The actual production execution of these steps is NOT authorized in this implementation task.

Tests must prove the tooling rejects an actual/predicted token mismatch.

---

# 4. GUEST ELIGIBILITY

Rooms and Room Service are for eligible EOAs only.

Financial snapshot eligibility requires:

`eth_getCode(wallet, snapshotBlock) == 0x`

Exclude:

- zero address;
- burn/dead addresses;
- all contracts;
- `RoomService.sol`;
- HoodLock;
- Pons infrastructure;
- pools;
- routers;
- system contracts;
- manually approved exclusions.

Deployer EOA counts normally when it personally holds unlocked `$HOTEL`.

One wallet = one room.

Eligibility must be evaluated using the relevant snapshot block, not merely latest-state code.

Add tests proving contract addresses cannot receive room allocation or Room Service allocation.

---

# 5. RANKING

Sort eligible holders by:

1. `$HOTEL` balance raw units DESC;
2. wallet numeric address ASC.

Lower numeric address wins equal-balance ties.

Implement deterministic address comparison.

Do not compare checksum strings lexicographically.

## Exact upgrade/check-in calculation

If:

`userAddress < targetAddress`

then:

`requiredBalance = targetBalance`

otherwise:

`requiredBalance = targetBalance + 1 raw token unit`

Then:

`additionalNeeded = max(requiredBalance - userBalance, 0)`

Use raw integer token units only.

Add tests for:

- user address lower than target;
- user address higher than target;
- exact tie;
- zero additional needed;
- +1 raw-unit requirement;
- room #100 threshold.

---

# 6. LAUNCH BLOCK VS HOTEL OPEN BLOCK

Index token state beginning from:

`HOTEL_LAUNCH_BLOCK`

This reconstructs balances from genesis.

However public HOTEL history and financial Services do not begin at the launch block.

After all of the following PASS:

- Pons launch;
- opening/dev-buy HoodLock;
- canonical production config;
- indexer caught up;
- first ranking;
- live activation gate;

record:

`HOTEL_OPEN_BLOCK`

and:

`HOTEL_OPEN_TIMESTAMP`

Pre-open transfers may affect reconstructed holder balances.

They must NOT create public HOTEL stays/history.

First Room Service:

first UTC 15-minute boundary strictly after `HOTEL_OPEN_TIMESTAMP`.

ETH accumulated in `RoomService.sol` before HOTEL opens must roll into that first Service.

Add tests around boundary timestamps exactly on a 15-minute boundary and just before/after one.

---

# 7. LIVE HOTEL STATE

Frontend poll interval:

`2 seconds`

Display only confirmed/indexed state.

Room/holder live state confirmation requirement:

`1 confirmation`

Do not display pending/mempool room movement.

If a displayed indexed state is later corrected due to reorg, update silently.

If ranking/indexer data is more than:

`30 seconds stale`

public state becomes:

`HOTEL SYNCING`

This stale condition must not silently serve old room assignments as current.

---

# 8. ROOM SERVICE SCHEDULING

Interval:

`900 seconds`

Timezone:

`UTC only`

Service number:

`floor(boundaryTimestamp / 900)`

Financial snapshot:

latest block at or before boundary with **2 confirmations** before finalization.

At countdown zero the UI may show:

`ROOM SERVICE ARRIVING`

Service rounds must finalize strictly sequentially.

Service `N+1` cannot finalize while `N` is unresolved.

Worker checks approximately every minute.

Catch-up maximum:

`8 Services per worker run`

Implement oldest-first deterministic catch-up.

---

# 9. MISSED SERVICES

For missed Services:

process oldest unresolved Service first.

Any currently accumulated unallocated Room Service is attributed to the earliest unresolved Service.

Do not build historical per-block Pons creator-fee attribution for HOTEL V1.

This is deliberate frozen V1 behavior.

---

# 10. AUTHORITATIVE FINANCIAL READS

After any Pons collection receipt confirms, choose one canonical financial-read block.

At the SAME block tag read:

- RoomService ETH balance;
- `totalRoomServiceClaimed()`;
- required RoomService financial state.

Calculate:

`totalReceivedWei = contractBalanceWei + totalRoomServiceClaimedWei`

Then:

`unallocatedWei = totalReceivedWei - totalFinalizedRoomServiceEarnedWei`

This claim-invariant formula is authoritative.

Never mix financial reads from different block tags in one Service finalization attempt.

A finalization attempt must record its canonical read block.

Add tests proving that mixed-block financial reads are not accepted by the finalization code path.

All financial math uses integer wei/raw units only.

No floating point.

---

# 11. ROOM SERVICE ALLOCATION

All ETH held by RoomService is Room Service.

For each qualifying guest:

`allocationWei = floor(servicePoolWei * guestBalanceRaw / totalEligibleBalanceRaw)`

No weighting.

No Penthouse bonus.

No caps.

No tier multiplier.

Dust stays unallocated and carries naturally into the next Service.

Finalized cumulative guest entitlement can only stay the same or increase.

Never claw back finalized Room Service.

Add invariant/property-style tests where practical for:

- allocations never exceed service pool;
- allocation is integer floor division;
- excluded addresses receive zero;
- cumulative earnings never decrease;
- claims do not alter total economic receipt calculation;
- dust remains available for later rounds;
- finalization is idempotent;
- service ordering cannot skip unresolved rounds.

---

# 12. `RoomService.sol` V1

Implement a non-upgradeable contract.

Use standard audited equivalents of:

- EIP712;
- ECDSA;
- ReentrancyGuard;
- Pausable;
- Ownable2Step.

Constructor:

`constructor(address hotelToken_, address ponsFeeEscrow_, address initialOwner_, address initialEntitlementSigner_)`

Immutable:

- `hotelToken`;
- `ponsFeeEscrow`.

Mutable:

- `entitlementSigner`;
- `signerEpoch`, initial value `1`;
- `roomServiceClaimed[address]`;
- `totalRoomServiceClaimed`.

Explicitly do NOT include:

- ETH withdrawal;
- token rescue;
- arbitrary execute;
- delegatecall;
- upgrade path;
- proxy support.

Disable ownership renunciation.

Owner authority must be limited to:

- pause claims;
- unpause claims;
- rotate entitlement signer;
- two-step ownership transfer.

Owner cannot:

- withdraw ETH;
- alter guest claim totals;
- alter finalized entitlement accounting;
- change immutable addresses;
- execute arbitrary calls.

Add tests proving forbidden administrative powers do not exist.

---

# 13. EIP-712 ROOM SERVICE CLAIMS

Claim type:

`RoomServiceClaim(address guest,uint256 cumulativeEntitlement,uint256 deadline,uint256 signerEpoch)`

Backend issuance policy:

signature validity = `24 hours`.

Signer epoch rotation immediately invalidates all signatures from old epochs.

Claims are cumulative.

For caller:

`payout = cumulativeEntitlement - roomServiceClaimed[msg.sender]`

Requirements:

- self-claim only;
- ETH goes only to `msg.sender`;
- no delegated recipient;
- no relayer flow;
- guest pays gas;
- no minimum claim;
- no partial payout;
- nothing claimable => revert;
- insufficient contract balance => revert.

On successful claim:

- update guest claimed state safely;
- update `totalRoomServiceClaimed`;
- send exact payout;
- protect against reentrancy;
- emit appropriate event(s).

Add comprehensive tests for:

- valid claim;
- replay of same cumulative entitlement;
- lower entitlement;
- wrong guest;
- wrong signer;
- expired signature;
- wrong signer epoch;
- rotated signer;
- insufficient balance;
- pause/unpause;
- reentrancy;
- total claimed accounting;
- cumulative claim progression.

---

# 14. ROOM SERVICE COLLECTION

`RoomService.sol` itself is the Pons creator-fee recipient.

Implement:

`collectRoomService()`

This is permissionless.

Behavior:

1. inspect Pons Fee Escrow `balanceOf(address(this))`;
2. if zero: safe no-op;
3. if positive: claim all;
4. ETH lands directly in RoomService.

No fee-custody keeper.

No intermediate fee wallet.

Write integration/unit tests against an interface/mock compatible with the repo's actual Pons V2 Fee Escrow API.

If the current repository's Pons V2 interface differs materially from this assumption, report the exact difference before adapting.

Do not change the economic invariant that RoomService is the direct creator-fee recipient.

---

# 15. ROLE SEPARATION

Production wallet model:

- deployer + owner EOA;
- entitlement signer EOA;
- worker writer EOA.

Exactly three production wallets are required for HOTEL V1.

The deployer and RoomService owner are intentionally the same EOA for MVP simplicity.

The entitlement signer must be distinct from the deployer/owner.

The worker writer must be distinct from both the deployer/owner and entitlement signer.

Worker writer is gas-only.

Entitlement signer is non-custodial.

The deployer/owner private key must not be stored in backend infrastructure.

Implement production config validation that enforces this exact three-wallet model.

Never invent these addresses.

---

# 16. ENTITLEMENT API

Implement SIWE-style wallet proof.

Challenge requirements:

- wallet-bound;
- single-use;
- expires after `5 minutes`;
- HOTEL domain-bound;
- Robinhood Chain / `4663` bound.

Production requirements:

- HTTPS only;
- no shared/CDN caching of signed entitlement responses;
- light wallet/IP rate limiting;
- entitlements signed only on demand.

Backend may sign only cumulative earnings from FINALIZED Services.

Before signing reconcile:

- finalized cumulative earned;
- onchain claimed state;
- current signer epoch.

The signed entitlement must never be below the onchain claimed amount.

A signer response must not create new economic entitlement; it only attests database-finalized cumulative earnings.

Implement replay-safe nonce/challenge handling.

---

# 17. WORKER / INDEXER

Architecture:

one small service.

Do not add:

- Redis;
- queues;
- microservices.

Index `$HOTEL` `Transfer` events starting from exact:

`HOTEL_LAUNCH_BLOCK`

Persist unique transfer identity:

`(tx_hash, log_index)`

Maintain:

- `last_indexed_block`;
- event cursor;
- `last_reconciled_block`.

Holder reconciliation interval:

every `5 minutes`

Also force reconciliation on:

- restart;
- reorg;
- indexing gap;
- mismatch.

Gap behavior:

1. stop advancing;
2. public state => `HOTEL SYNCING`;
3. backfill;
4. reconcile;
5. resume.

Do not silently advance past a detected gap.

---

# 18. REORG / CONFIRMATION BEHAVIOR

Live holder state:

`1 confirmation`

Financial Service snapshot/finalization:

`2 confirmations`

Collection receipt before financial read:

`1 confirmation`

Implement explicit distinction between these confirmation policies.

A reorg affecting recent room state may silently correct the displayed room assignment.

A financial Service must not finalize from an insufficiently confirmed snapshot.

Persist enough audit metadata to reconstruct which blocks were used.

---

# 19. PONS COLLECTION WORKER WRITES

Worker collection write flow:

**simulate → broadcast → verify receipt**

Confirmation requirement:

`1 confirmation`

Transient in-run retry schedule approximately:

- ~2 seconds;
- ~5 seconds;
- ~10 seconds.

Maximum:

`3 in-run attempts`

Failure blocks Service finalization only.

Live rooms continue updating.

Public financial state:

`ROOM SERVICE DELAYED`

After `30 minutes` pending:

operational state:

`STUCK`

STUCK continues automatic retries and may auto-recover.

Record worker write attempts safely in audit storage.

Never record secrets.

---

# 20. DATABASE

Use:

`Supabase / Postgres`

All uint256-compatible financial/raw integer fields:

`numeric(78,0)`

Store addresses lowercase.

Core tables required:

- `hotel_deployment`;
- `system_state`;
- `holders`;
- `holder_balance_checkpoints`;
- `processed_transfer_logs`;
- `guest_stays`;
- `room_history`;
- `room_move_events`;
- `service_rounds`;
- `service_allocations`;
- `guest_entitlements`;
- `room_service_claims`;
- `public_activity`;
- `excluded_addresses`;
- `auth_nonces`;
- `config_versions`;
- `config_change_audit`;
- `operational_incidents`;
- `worker_write_audit`;
- `deployment_audits`.

Create these as the canonical HOTEL database tables unless a clearly documented implementation reason requires a naming adjustment.

Document any naming adaptation explicitly.

## Service finalization transaction

Service finalization must execute as ONE atomic Postgres transaction/RPC.

Use DB/advisory locking to prevent concurrent duplicate finalization.

Finalized Services are immutable.

A failed finalization transaction must leave no partial allocations.

Add database tests/integration tests for:

- duplicate finalization;
- concurrent finalization;
- rollback on error;
- immutable finalized round;
- monotonic entitlement update.

---

# 21. GUEST STAYS + ROOM HISTORY

Public HOTEL history begins only at HOTEL open.

Do not create public pre-open stays from launch-block reconstruction.

Track enough state to support:

- current room;
- checked-in since;
- best room ever;
- stay duration;
- room moves;
- stay end;
- Penthouse changes.

A zero-balance former guest becomes:

`NOT CHECKED IN`

but retains history and claimable Room Service.

---

# 22. PUBLIC HOTEL UI

Pre-live website is already deployable/online.

Pre-live state:

`HOTEL CHECK-IN OPENS SOON`

Explicit config:

`HOTEL_LIVE=false/true`

Up to 100 visible rooms.

Unused rooms:

`VACANT`

Occupied room view includes:

- current room;
- live rank;
- shortened wallet;
- compact `$HOTEL` balance;
- checked-in since;
- simple stay duration;
- best room ever;
- Room Service waiting;
- next Service countdown;
- exact tokens required to move up one room.

Lobby view includes:

- live rank;
- balance;
- Room #100 threshold;
- exact tokens needed to check in;
- best room ever;
- prior Room Service waiting;
- next Service countdown.

Zero-balance former guests:

`NOT CHECKED IN`

Do not fabricate unindexed/pending movement.

Stale >30 seconds:

`HOTEL SYNCING`

Financial delay state:

`ROOM SERVICE DELAYED`

At boundary before finalization:

`ROOM SERVICE ARRIVING`

---

# 23. PUBLIC ACTIVITY

Display latest:

`50 events`

Newest first.

Event classes:

- check-in;
- stay end;
- upgrade;
- downgrade;
- Penthouse changed;
- non-zero Room Service arrived;
- successful Room Service claim.

Failed claims remain operational/private.

Do not put failed claim attempts into public activity.

---

# 24. LIVE ACTIVATION GATE

HOTEL live activation requires PASS for ALL:

- Pons launch;
- actual token == predicted token;
- HoodLock;
- production config;
- worker catch-up;
- first ranking;
- contract immutables;
- owner;
- signer;
- signer epoch;
- claims unpaused;
- pre-live claim simulation;
- no active indexing stale state.

Implement this as a deterministic gate, not a subjective checklist.

If any condition is not proven:

`BLOCKED`

Do not set `HOTEL_LIVE=true`.

During this implementation task, production live activation is NOT authorized.

---

# 25. HOODLOCK REQUIREMENTS

100% of opening/dev-buy `$HOTEL` must be locked.

Opening buy:

`0.06 ETH`

Opening buy max slippage:

`100 bps`

Opening buy recipient:

deployer EOA.

Lock amount:

exact full `$HOTEL` amount received by the atomic opening buy.

Minimum lock duration:

`7 days`

Production target unlock timestamp:

`latest chain timestamp + 604800 + 300 seconds`

Production verification must prove:

- approval;
- lock tx;
- `Locked` event;
- owner;
- token;
- amount;
- unlock timestamp;
- onchain lock state.

Site live activation:

`BLOCKED` until HoodLock PASS.

Implement dry-run/simulation/verification tooling.

Do not execute the real production lock in this task.

---

# 26. PRODUCTION CONFIG SAFETY GATE

Before any future irreversible production action, tooling must verify:

- clean git working tree;
- branch = `main`;
- local main == origin/main;
- exact HEAD recorded;
- committed launch config matches local runtime config;
- runtime chain ID = `4663`;
- active signer matches required role;
- target contract code verified;
- simulation PASS;
- explicit manual confirmation.

Verdict:

`PASS` or `BLOCKED`

No production command may bypass this gate accidentally.

Prefer explicit command-line confirmation flags for any future broadcast script.

Do not treat presence of an environment variable as manual confirmation.

---

# 27. FINAL CANARY STATE MACHINE

HOTEL may become publicly live before final canary.

Initial post-live status:

`LIVE — CANARY PENDING`

Final MVP proof requires:

real guest
→ real finalized Service
→ real entitlement
→ real claim
→ real ETH received

Only then status may become:

`PASS — MVP LIVE`

Implement the status/state support.

Do not execute this real production canary in this task.

---

# 28. CONFIGURATION INPUTS — DO NOT INVENT

The following may remain unresolved until later and must be cleanly configurable:

- brand/domain values;
- final token metadata;
- Pons V2 production addresses if not already canonical in repo;
- HoodLock production addresses if not already canonical in repo;
- deployer + RoomService owner EOA;
- entitlement signer EOA;
- worker writer EOA;
- RPC URLs;
- Supabase credentials;
- entitlement signer private-key source;
- salt;
- deterministic Pons launch config inputs;
- manually excluded production addresses;
- live activation flag;
- any deployment-specific IDs.

If a value is required to compile/test, use safe local test fixtures or mocks.

Do not substitute a made-up value into production config.

---

# 29. EXPECTED IMPLEMENTATION PHASES

Create the repo structure first, then preserve these logical gates.

## Gate A — Repository bootstrap + implementation-plan audit

Create the new HOTEL repository/workspace and minimal architecture.

At minimum establish logical homes for:

- `contracts/` or equivalent Solidity workspace;
- `apps/web/`;
- `apps/worker/` or equivalent single worker/indexer service;
- `packages/` shared domain/config logic where useful;
- `supabase/` migrations/functions or equivalent;
- `scripts/` deployment/simulation/verification tooling;
- `audit/`;
- root config/tooling.

Avoid over-engineering.

Output:

`audit/hotel-mvp-repository-bootstrap.md`

Must PASS before Gate B.

---

## Gate B — Canonical config + shared domain logic

Implement:

- HOTEL config schema;
- production config validation;
- role separation validation;
- address normalization;
- ranking;
- tie-breaking;
- required-balance math;
- Service boundary math;
- confirmation policy constants;
- HOTEL status enums/state.

Tests required.

Audit report:

`audit/hotel-mvp-gate-b-domain-config.md`

---

## Gate C — RoomService.sol

Implement contract + interfaces + tests.

Include:

- immutable hotel token;
- immutable Pons Fee Escrow;
- EIP-712 claims;
- signer epoch;
- cumulative claims;
- pause;
- signer rotation;
- Ownable2Step;
- disabled renounce;
- permissionless Pons collection;
- no withdrawal/rescue/execute/upgrade.

Audit:

`audit/hotel-mvp-gate-c-roomservice-contract.md`

---

## Gate D — Database schema + financial finalization RPC

Implement required HOTEL persistence.

Must include:

- numeric(78,0);
- lowercase addresses;
- unique transfer logs;
- service-round sequencing;
- atomic Service finalization;
- advisory/DB lock;
- immutable finalized rounds;
- cumulative entitlement updates.

Audit:

`audit/hotel-mvp-gate-d-database.md`

---

## Gate E — Indexer + reconciliation

Implement:

- launch-block indexing;
- Transfer persistence;
- balances;
- checkpointing;
- `eth_getCode(..., snapshotBlock)` eligibility support;
- excluded address handling;
- 1-confirmation live state;
- gap detection;
- reorg handling;
- five-minute reconciliation;
- stale-state handling.

Audit:

`audit/hotel-mvp-gate-e-indexer.md`

---

## Gate F — Room Service worker

Implement:

- UTC quarter-hour rounds;
- 2-confirmation financial snapshots;
- sequential oldest-first finalization;
- max 8 catch-ups/run;
- permissionless collection write;
- simulate/broadcast/receipt verification abstraction;
- one canonical financial-read block;
- claim-invariant received calculation;
- integer pro-rata allocation;
- dust carry;
- delay/STUCK behavior;
- retries;
- worker audit records.

Audit:

`audit/hotel-mvp-gate-f-room-service-worker.md`

---

## Gate G — Entitlement API

Implement:

- challenge creation;
- 5-minute expiry;
- one-time nonce;
- wallet/domain/chain binding;
- signature verification;
- rate limiting;
- no-cache headers;
- finalized-only entitlements;
- onchain claimed reconciliation;
- signer epoch;
- 24-hour entitlement signature deadline;
- self-claim payload support.

Audit:

`audit/hotel-mvp-gate-g-entitlement-api.md`

---

## Gate H — Public HOTEL UI

Implement:

- pre-live screen;
- live rooms;
- Penthouse;
- Rooms 2–100;
- lobby;
- vacant state;
- 2-second polling;
- sync state;
- Room Service countdown;
- arriving/delayed states;
- claimable waiting;
- exact move-up/check-in math;
- best room/stay metadata;
- NOT CHECKED IN;
- latest 50 public events.

Audit:

`audit/hotel-mvp-gate-h-frontend.md`

---

## Gate I — Deployment + prediction + HoodLock tooling

Because this is a greenfield repo, first add only the external Pons V2 / HoodLock interfaces and configuration actually needed by HOTEL. Do not vendor or recreate those protocols.

Implement safe tooling for:

- frozen launch config;
- frozen salt;
- deterministic Pons token prediction;
- RoomService deployment args;
- contract verification checks;
- token launch simulation;
- predicted-vs-actual assertion;
- 0.06 ETH atomic opening-buy simulation;
- 1% max slippage;
- exact received token measurement;
- full-token HoodLock approval/lock simulation;
- unlock timestamp calculation;
- HoodLock verification;
- clean git/main/origin/config/chain/signer/code checks;
- explicit manual confirmation requirement.

No production broadcast.

Audit:

`audit/hotel-mvp-gate-i-deployment-tooling.md`

---

## Gate J — Live activation + canary state support

Implement deterministic activation checks and state machine.

Do not set production live.

Do not run real canary.

Audit:

`audit/hotel-mvp-gate-j-activation-canary-state.md`

---

## Gate K — Full verification / implementation closure

Run:

- contract tests;
- unit tests;
- integration tests;
- database tests;
- frontend tests;
- lint;
- typecheck;
- build;
- any repo-standard security/static analysis;
- production-config validation in non-secret dry-run form;
- deployment tooling dry-run/simulation where possible.

Create final report:

`audit/hotel-mvp-implementation-completion.md`

Verdict must be either:

`PASS — HOTEL MVP IMPLEMENTATION COMPLETE; PRODUCTION LAUNCH NOT PERFORMED`

or

`BLOCKED — HOTEL MVP IMPLEMENTATION INCOMPLETE`

---

# 30. REQUIRED SECURITY / FINANCIAL TEST MATRIX

At minimum add automated coverage for:

## Contract

- constructor validation;
- immutables;
- signer epoch starts at 1;
- signer rotation increments/invalidates old signature;
- valid cumulative claim;
- replay/no-delta rejection;
- lower cumulative entitlement rejection;
- expired entitlement;
- wrong guest;
- wrong signer;
- wrong epoch;
- paused claims;
- unpause;
- insufficient ETH;
- reentrancy protection;
- exact claimed delta;
- total claimed accounting;
- permissionless collect;
- zero-fee collect no-op;
- positive-fee collect all;
- no ETH withdrawal path;
- no token rescue;
- no arbitrary execute;
- no upgrade;
- ownership renunciation disabled;
- two-step owner transfer.

## Ranking / eligibility

- contracts excluded at snapshot block;
- EOAs included;
- manual exclusions;
- zero/burn exclusions;
- deterministic tie;
- lower address tie winner;
- required-balance +1 raw-unit case;
- one wallet one room;
- top 100 only;
- room #100/lobby boundary.

## Indexing

- starts exact launch block;
- `(tx_hash, log_index)` idempotency;
- restart safe;
- gap detection;
- no advancing past gap;
- reconciliation mismatch;
- reorg correction;
- stale >30 sec => syncing;
- pre-open transfers do not generate public stay history.

## Services

- first Service boundary strictly after open timestamp;
- exact-boundary edge case;
- sequential finalization;
- unresolved N blocks N+1;
- oldest-first missed Service;
- max 8 catch-ups;
- 2-confirmation snapshot;
- canonical financial-read block;
- `balance + totalClaimed` invariant;
- unallocated calculation;
- integer pro-rata;
- dust carry;
- no Penthouse bonus;
- no weighting;
- finalized cumulative never decreases;
- excluded address zero allocation;
- atomic DB finalization;
- duplicate/concurrent finalization blocked;
- collection failure delays Service but not rooms;
- STUCK after 30 minutes;
- auto-recovery path.

## API

- challenge single-use;
- challenge 5-minute expiry;
- wallet binding;
- domain binding;
- chain 4663 binding;
- no cache;
- finalized-only earnings;
- reconcile onchain claimed;
- signer epoch;
- 24-hour signature deadline;
- rate limiting.

## Deployment safety

- predicted token mismatch => BLOCKED;
- wrong chain => BLOCKED;
- wrong branch => BLOCKED;
- dirty tree => BLOCKED;
- local main != origin/main => BLOCKED;
- config mismatch => BLOCKED;
- wrong signer role => BLOCKED;
- failed simulation => BLOCKED;
- missing explicit confirmation => BLOCKED;
- incomplete HoodLock verification => BLOCKED;
- entitlement signer equals deployer/owner => BLOCKED;
- worker writer equals deployer/owner or entitlement signer => BLOCKED.

---

# 31. IMPLEMENTATION QUALITY RULES

Prefer:

- small deterministic functions;
- explicit integer types;
- shared canonical domain functions;
- no duplicate financial formulas across services;
- typed config;
- idempotent workers;
- transaction-safe DB writes;
- logs that aid audit without leaking secrets;
- structured operational error states;
- fail-closed production gates.

Avoid:

- floating-point financial math;
- implicit timezone behavior;
- inferred token decimals in raw-unit logic;
- hidden automatic broadcasts;
- mutable finalized accounting;
- frontend-derived financial truth;
- worker-only memory as canonical state;
- catch-all error swallowing;
- optimistic public room changes from mempool data;
- architecture expansion beyond one worker/service.

---

# 32. DOCUMENTATION REQUIREMENTS

Update or add concise documentation covering:

- local HOTEL development;
- config keys;
- production config validation;
- RoomService contract;
- Service accounting;
- worker/indexer;
- entitlement API;
- deployment dry-run;
- activation gate;
- future production launch sequence.

Do not expose secrets.

Document which values are intentionally unresolved.

---

# 33. FINAL HANDOFF REQUIREMENTS

At completion, return to the human operator:

1. final verdict;
2. path to `audit/hotel-mvp-implementation-completion.md`;
3. git HEAD;
4. working-tree status;
5. concise gate summary;
6. tests/checks summary;
7. unresolved configuration inputs;
8. any BLOCKED items;
9. exact next recommended action;
10. explicit statement:

`REAL HOTEL PRODUCTION LAUNCH PERFORMED: NO`

The completion report must be complete enough to upload back into ChatGPT for independent review.

---

# 34. FROZEN HOTEL MVP SPECIFICATION SUMMARY

The implementation must preserve the following canonical invariants:

- 100-room live holder hotel;
- rank #1 Penthouse;
- ranks #2–#100 rooms;
- #101+ lobby;
- eligible EOAs only;
- snapshot-block contract exclusion;
- deterministic raw-unit/address ranking;
- 15-minute UTC Room Service;
- top-100 pro-rata creator-revenue allocation;
- immutable cumulative finalized entitlement;
- RoomService direct creator-fee recipient;
- permissionless Pons fee collection;
- cumulative EIP-712 self-claims;
- signer epoch;
- no contract withdrawal/admin seizure path;
- launch-block indexing;
- distinct HOTEL open block/timestamp;
- 1-confirm live room state;
- 2-confirm financial snapshot;
- one-block-tag financial reads per attempt;
- `balance + totalClaimed` total-received invariant;
- missed Service oldest-first allocation;
- atomic DB finalization;
- one worker service;
- no Redis/queues/microservices;
- explicit stale/delayed/STUCK states;
- deterministic Pons token prediction before RoomService deployment;
- predicted token must equal actual token;
- Pons creator tax 3%;
- native ETH pair;
- Pons buyback off;
- 0.06 ETH opening buy;
- 1% max slippage;
- 100% received opening-buy HOTEL locked;
- HoodLock minimum 7 days;
- production target 7 days + 5 minutes;
- deterministic live activation gate;
- final real guest Service/claim canary required for `PASS — MVP LIVE`;
- production launch explicitly deferred to a later authorized gate.

If implementation pressure conflicts with one of these invariants:

**STOP → BLOCKED → REPORT.**

Do not redesign it.
