<p align="center">
    <h1 align="center">🍝 Lasagna</h1>
    <p align="center">A private prediction market on Aleo with deferred aggregate revelation - bet direction is fully private, pool totals hidden until resolution.</p>
</p>

<p align="center">
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
    <a href="https://developer.aleo.org/"><img src="https://img.shields.io/badge/Aleo-Testnet_Beta-1E1E2E"></a>
    <a href="https://discord.gg/aleo"><img src="https://img.shields.io/discord/700454073459015690?logo=discord"></a>
</p>

<p align="center">
    <b>Live Demo:</b> <a href="https://lasagna-markets.vercel.app">lasagna-markets.vercel.app</a> · <b>Contract:</b> <code>prediction_market_test007.aleo</code> · <b>84 tests passing</b>
</p>

## Table of Contents

* [1. Overview](#1-overview)
* [2. Architecture](#2-architecture)
    * [2.1 Privacy Model (Deferred Aggregate Revelation)](#21-privacy-model-deferred-aggregate-revelation)
    * [2.2 Pedersen Commitment Scheme](#22-pedersen-commitment-scheme)
    * [2.3 Parimutuel Mechanics](#23-parimutuel-mechanics)
    * [2.4 Market Lifecycle](#24-market-lifecycle)
* [3. Smart Contract](#3-smart-contract)
    * [3.1 Program Details](#31-program-details)
    * [3.2 Record Types](#32-record-types)
    * [3.3 Public Mappings](#33-public-mappings)
    * [3.4 Transitions](#34-transitions)
    * [3.5 Oracle Integration](#35-oracle-integration)
* [4. Build Guide](#4-build-guide)
    * [4.1 Requirements](#41-requirements)
    * [4.2 Installation](#42-installation)
    * [4.3 Build the Contract](#43-build-the-contract)
* [5. Deploy](#5-deploy)
    * [5.1 Testnet Deployment](#51-testnet-deployment)
    * [5.2 Initialize the Contract](#52-initialize-the-contract)
    * [5.3 Create a Market](#53-create-a-market)
* [6. Frontend](#6-frontend)
    * [6.1 Local Development](#61-local-development)
    * [6.2 Production Build](#62-production-build)
    * [6.3 Supabase Backend](#63-supabase-backend)
* [7. Testing](#7-testing)
    * [7.1 Contract Tests](#71-contract-tests)
    * [7.2 Frontend Tests](#72-frontend-tests)
* [8. Project Structure](#8-project-structure)
* [9. Tech Stack](#9-tech-stack)
* [10. Acknowledgments](#10-acknowledgments)
* [11. License](#11-license)

## 1. Overview

Lasagna is a parimutuel prediction market where users bet on binary (YES/NO) outcomes using Aleo credits. Unlike traditional prediction markets where every trade is public, Lasagna keeps bet directions fully private using Pedersen commitments and hides pool totals until resolution via **Deferred Aggregate Revelation (DAR)**.

Winners split the opposing pool proportionally, minus a 2% fee. Bet records are encrypted Aleo records - an observer can see that *someone* placed a bet in a given tier, but cannot determine which wallet placed it or which direction they chose.

The contract is deployed on Aleo Testnet Beta as `prediction_market_test007.aleo`. It depends on `credits.aleo` for native credit transfers and `official_oracle_v2.aleo` for attested data feeds.

Built for the [Aleo Privacy Buildathon](https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo).

## 2. Architecture

```
┌─────────────────────┐      ┌────────────────────────┐
│  Frontend (React)   │─────▶│  Aleo Testnet Beta     │
│  Shield Wallet      │      │  prediction_market_     │
│  Delegated Proving  │      │  test007.aleo           │
└────────┬────────────┘      └──────────┬─────────────┘
         │                              │
         │  metadata                    │  on-chain state
         ▼                              ▼
┌─────────────────────┐      ┌────────────────────────┐
│  Supabase           │◀─────│  Indexer Edge Function  │
│  PostgreSQL + REST  │      │  (polls chain every 60s)│
└─────────────────────┘      └────────────────────────┘
```

The frontend uses [Shield Wallet](https://shieldwallet.app/) for delegated ZK proof generation via `@provablehq/aleo-wallet-adaptor-*`. Market metadata (title, description, category) is stored in Supabase. On-chain state (status, outcome, aggregate commitments) is indexed by a cron Edge Function. If Supabase is unavailable, the frontend falls back to direct Aleo explorer API calls.

The frontend also cross-references on-chain status for closed/resolved markets, with a sessionStorage-backed high-water-mark cache to prevent stale data from reverting displayed status.

### 2.1 Privacy Model (Deferred Aggregate Revelation)

Privacy is the core innovation. Wave 1 had a critical flaw: bet direction (`outcome: bool`) was a public finalize argument, and pool totals updated on every bet. An observer could see exactly who bet what direction and when. Wave 2 fixes this completely.

| Data | Visibility | Notes |
|------|-----------|-------|
| Market existence, status, outcome | Public | On-chain mappings |
| Pool totals (YES/NO) | **Hidden until resolution** | Only set in `resolve_market` finalize |
| Bet direction (YES/NO) | **Private** | Pedersen commitment only; never in finalize args |
| Bet amount | Public | Fixed denomination tiers for indistinguishability |
| Bettor identity (wallet) | **Private** | Encrypted in Bet record |
| Aggregate commitments | Public | `yes_aggregate_commit`, `no_aggregate_commit` (group elements) |
| Individual blinding factors | **Private** | Client-side only |

**How DAR works:**

1. **During betting**: Users place bets with a private `outcome` and a random private `nonce_value` (scalar blinding factor). A Pedersen commitment is computed and added to the on-chain aggregate via group addition in finalize. Pool totals (`yes_pool`, `no_pool`) stay at zero.

2. **Aggregate hiding**: Only aggregate commitments (group elements) are public. An observer sees two group elements per market but cannot determine which carries the real amount for any individual bet.

3. **At resolution**: Admin provides the outcome, pool totals, and summed blinding factors. The contract verifies: `yes_pool_amount * G + yes_blinding_sum * H == yes_aggregate_commit[market_id]` (and same for NO). Only upon successful verification are pool totals set and the market resolved.

4. **Dispute mechanism**: Post-resolution, a dispute window allows bettors to submit ZK proofs of bet ownership via `submit_bet_proof`. If disputes reach a threshold, the admin re-resolves via `resolve_disputed`.

**Why DAR > Commit-Reveal:**

- **Single transaction UX** - no multi-phase commit/reveal dance
- **No real-time leakage** - pools frozen during betting, no sentiment signal
- **Homomorphic efficiency** - aggregates without per-bet revelations
- **Stronger anonymity** - bet directions are private forever, not just temporarily hidden

### 2.2 Pedersen Commitment Scheme

We discovered that Aleo's built-in `Pedersen128::commit_to_group` is **NOT additively homomorphic** for messages. It uses windowed bit-decomposition hashing, which means `commit(a, r1) + commit(b, r2) != commit(a+b, r1+r2)`. This broke aggregate verification in `resolve_market` after deploying as `test005`.

The fix: standard Pedersen commitments using `m*G + r*H`:

```
commitment = (amount as scalar) * group::GEN + nonce_value * Poseidon2::hash_to_group(0field)
```

Where:
- `G = group::GEN` (Aleo's built-in group generator)
- `H = Poseidon2::hash_to_group(0field)` (nothing-up-my-sleeve point - deterministic, no trapdoor)

This scheme is truly additively homomorphic: `(a*G + r1*H) + (b*G + r2*H) = (a+b)*G + (r1+r2)*H`. Deployed as `prediction_market_test007.aleo`.

### 2.3 Parimutuel Mechanics

All bets go into a shared pool. After resolution, the losing side's credits are distributed to winners proportional to their bet size, minus a 2% platform fee.

**Payout formula** (replicated exactly in the contract and frontend):

```
total_pool   = yes_pool + no_pool
fee_amount   = (total_pool * 200) / 10000        # 2% (200 basis points)
net_pool     = total_pool - fee_amount
winning_pool = yes_pool if YES won, else no_pool
payout       = (bet_amount * net_pool) / winning_pool
```

The contract uses `u128` intermediate arithmetic to avoid overflow when multiplying large `u64` values.

**Claim-before-verify pattern**: The user calculates their payout off-chain and provides `claimed_amount` as a public input to `claim_winnings`. The contract independently recomputes the expected payout from on-chain state and asserts equality. If the claim is wrong, the transaction fails and no funds move.

### 2.4 Market Lifecycle

```
    ┌──────────────┐
    │  create_market│
    └──────┬───────┘
           ▼
    ┌──────────────┐   pause_market
    │    OPEN (0)  │◄──────────────► paused
    │  accept bets │   unpause_market
    └──────┬───────┘
           │ close_betting
           ▼
    ┌──────────────┐
    │  CLOSED (1)  │──── cancel_market ────►┐
    │  no new bets │                        │
    └──────┬───────┘                        │
           │ resolve_market                 │
           │ (verify commitments)           │
           │ resolve_with_oracle            │
           ▼                                ▼
    ┌──────────────┐                ┌──────────────┐
    │ RESOLVED (2) │                │CANCELLED (3) │
    │ claim_winnings│                │ claim_refund │
    │ withdraw_fees │                └──────────────┘
    │ (dispute →   │
    │  re-resolve) │
    └──────────────┘
```

Markets can also be cancelled directly from OPEN state via `cancel_market`.

## 3. Smart Contract

### 3.1 Program Details

| Field | Value |
|-------|-------|
| Program ID | `prediction_market_test007.aleo` |
| Leo version | 3.4.0 |
| Network | Testnet Beta |
| Dependencies | `credits.aleo`, `official_oracle_v2.aleo` |
| Lines of code | 801 |
| Minimum bet | 1,000 microcredits (0.001 credits) |
| Fee rate | 200 basis points (2%) |
| Source | [`contracts/prediction_market/src/main.leo`](contracts/prediction_market/src/main.leo) |

### 3.2 Record Types

The contract defines one private record:

```leo
record Bet {
    owner: address,         // bettor address (private)
    market_id: field,       // which market (private)
    outcome: bool,          // true = YES, false = NO (private)
    amount: u64,            // bet size in microcredits (private)
    nonce_value: scalar,    // blinding factor for Pedersen commitment (private)
}
```

A `Bet` record is created by `place_bet` or `add_to_bet`, and consumed (spent) by `claim_winnings` or `claim_refund`. Consuming the record prevents double-claims. The `nonce_value` is a random scalar used as the blinding factor in the Pedersen commitment - it is never revealed on-chain.

### 3.3 Public Mappings

**Market state:**

| Mapping | Type | Description |
|---------|------|-------------|
| `market_status` | `field => u8` | 0=OPEN, 1=CLOSED, 2=RESOLVED, 3=CANCELLED |
| `yes_pool` | `field => u64` | Aggregate credits bet on YES (**only set at resolution**) |
| `no_pool` | `field => u64` | Aggregate credits bet on NO (**only set at resolution**) |
| `market_outcome` | `field => bool` | Winning outcome after resolution |
| `market_end_time` | `field => u32` | Block height deadline for betting |
| `market_paused` | `field => bool` | Emergency pause flag |
| `market_creator` | `field => address` | Address that created the market |
| `market_yes_label` | `field => field` | Hash of YES outcome label |
| `market_no_label` | `field => field` | Hash of NO outcome label |

**Aggregate commitments (DAR):**

| Mapping | Type | Description |
|---------|------|-------------|
| `yes_aggregate_commit` | `field => group` | Sum of all YES bet Pedersen commitments |
| `no_aggregate_commit` | `field => group` | Sum of all NO bet Pedersen commitments |

**Access control (singleton pattern using `bool => T`):**

| Mapping | Type | Description |
|---------|------|-------------|
| `admin` | `bool => address` | Contract administrator |
| `operator` | `bool => address` | Delegated operator (subset of admin permissions) |

**Fees:**

| Mapping | Type | Description |
|---------|------|-------------|
| `collected_fees` | `field => u64` | Finalized fee amount per market |
| `fees_withdrawn` | `field => bool` | Whether fees have been claimed |
| `estimated_fees` | `field => u64` | Running estimate (updated on each bet) |

**Market registry (enumeration without iteration):**

| Mapping | Type | Description |
|---------|------|-------------|
| `market_count` | `bool => u64` | Total markets created (singleton) |
| `market_ids` | `u64 => field` | Index-to-market-ID lookup |

**Oracle:**

| Mapping | Type | Description |
|---------|------|-------------|
| `oracle_enabled` | `field => bool` | Whether market uses oracle resolution |
| `oracle_request_hash` | `field => u128` | Hash linking to oracle data |
| `price_threshold` | `field => u128` | Price threshold for YES outcome |

### 3.4 Transitions

**User transitions** (permissionless):

| Transition | Privacy | Description |
|-----------|---------|-------------|
| `place_bet(market_id, outcome, amount, nonce_value)` | outcome + nonce **private** | Place a bet. Computes Pedersen commitment, adds to aggregate. Returns encrypted `Bet` record. |
| `add_to_bet(existing_bet, additional_amount, nonce_value)` | bet record **private** | Add funds to existing bet. Consumes old record, returns combined. |
| `claim_winnings(bet, claimed_amount)` | bet record **private** | Claim payout after resolution. Contract verifies the claimed amount. |
| `claim_refund(bet)` | bet record **private** | Full refund for cancelled markets. |
| `submit_bet_proof(bet)` | ZK proof of ownership | Submit proof during dispute window. |
| `resolve_with_oracle(market_id)` | all public | Permissionless oracle resolution via zkPortal attested data. |

**Admin transitions**:

| Transition | Access | Description |
|-----------|--------|-------------|
| `initialize(admin_address)` | Once | Set the admin address. Cannot be called twice. |
| `create_market(market_id, end_time, yes_label, no_label)` | Admin | Create a new market. Registers in global index. |
| `close_betting(market_id)` | Admin/Operator | Stop accepting bets. Required before resolution. |
| `resolve_market(market_id, outcome, yes_pool, no_pool, yes_blinding, no_blinding)` | Admin | Verify commitments, set pools, resolve market. |
| `resolve_disputed(market_id, outcome, yes_pool, no_pool, yes_blinding, no_blinding)` | Admin | Resolve after dispute window. |
| `cancel_market(market_id)` | Admin | Cancel market (OPEN or CLOSED). Enables refunds. |
| `withdraw_fees(market_id, claimed_fee_amount)` | Admin | Withdraw 2% fee. Transfers credits to admin. |
| `set_operator(operator_address)` | Admin | Delegate close/pause permissions. |
| `pause_market(market_id)` / `unpause_market(market_id)` | Admin/Operator | Emergency controls. |
| `set_market_oracle(market_id, threshold, request_hash)` | Admin | Configure oracle parameters before close. |

### 3.5 Oracle Integration

Markets can be configured for automatic resolution using [zkPortal](https://zkportal.io/) oracle data attested via SGX enclaves.

**Setup** (admin calls `set_market_oracle` while market is OPEN):
- `threshold`: Price value as `u128`. YES wins if the attested data is >= this value.
- `request_hash`: Identifier linking to the oracle data entry in `official_oracle_v2.aleo/sgx_attested_data`.

**Resolution** (anyone calls `resolve_with_oracle` after market is CLOSED):
1. Contract reads `AttestedData { data: u128, attestation_timestamp: u128 }` from the oracle program.
2. Compares `attested.data >= threshold`.
3. Sets outcome and marks market as RESOLVED.

This is permissionless - once oracle data is on-chain, any address can trigger resolution.

## 4. Build Guide

### 4.1 Requirements

- [Leo](https://developer.aleo.org/leo/) v3.4.0+
- [Bun](https://bun.sh/) v1.0+
- [Shield Wallet](https://shieldwallet.app/) browser extension
- Testnet credits from the [Aleo Faucet](https://faucet.aleo.org/)

### 4.2 Installation

Clone the repository:

```bash
git clone https://github.com/ss251/private-prediction-market.git
cd private-prediction-market
```

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your admin private key and address:

```
VITE_NETWORK=testnet
VITE_API_ENDPOINT=https://api.explorer.provable.com/v1
VITE_PROGRAM_ID=prediction_market_test007.aleo
ADMIN_PRIVATE_KEY=APrivateKey1zkp...
ADMIN_ADDRESS=aleo1...
PRIORITY_FEE=1000000
```

Install frontend dependencies:

```bash
cd frontend
bun install
```

Install test dependencies:

```bash
cd ../tests
bun install
```

### 4.3 Build the Contract

```bash
cd contracts/prediction_market
leo build
```

This compiles the Leo source to Aleo instructions in `build/main.aleo`.

## 5. Deploy

### 5.1 Testnet Deployment

The deploy script builds the contract and broadcasts the deployment transaction:

```bash
./scripts/deploy.sh testnet
```

To deploy and immediately initialize (set the deployer as admin):

```bash
./scripts/deploy.sh testnet --init
```

### 5.2 Initialize the Contract

If you deployed without `--init`, call `initialize` separately. This can only be called once.

```bash
leo execute initialize "<YOUR_ADMIN_ADDRESS>" \
    --network testnet \
    --endpoint "https://api.explorer.provable.com/v1" \
    --broadcast \
    --yes
```

### 5.3 Create a Market

```bash
leo execute create_market \
    "1field" \
    "9999999u32" \
    "1field" \
    "2field" \
    --network testnet \
    --endpoint "https://api.explorer.provable.com/v1" \
    --broadcast \
    --yes
```

Arguments: `market_id` (field), `end_time` (block height, u32), `yes_label_hash` (field), `no_label_hash` (field).

A helper script is also available:

```bash
./scripts/create_market.sh 1field "Will BTC reach 100k?"
```

## 6. Frontend

### 6.1 Local Development

```bash
cd frontend
bun dev
```

The dev server starts at `http://localhost:5173`. Vite is configured with:
- `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` headers (required for `SharedArrayBuffer` used by WASM proof generation)
- `@provablehq/sdk` and `@provablehq/wasm` excluded from dependency pre-bundling
- ES module workers for Comlink-based proof generation

### 6.2 Production Build

```bash
cd frontend
bun run build
```

Output is in `frontend/dist/`. The production deployment uses Vercel with `Cross-Origin-Embedder-Policy: credentialless` (instead of `require-corp`) to allow cross-origin wallet and Supabase connections.

### 6.3 Supabase Backend

The frontend uses Supabase for market metadata and chain state caching. This replaces the N+1 query problem of fetching each mapping value individually from the Aleo explorer API.

**Tables**: `markets`, `categories`, `pool_snapshots`, `platform_stats`, `user_positions`, `market_blindings`

**Edge Functions**:
- `index-markets`: Cron (every 60s). Reads on-chain state from the explorer API, upserts into `markets`, captures pool snapshots, updates platform stats.
- `create-market-metadata`: HTTP POST. Called by the frontend after a successful on-chain `create_market` transaction to store title, description, category, and tags.
- `cleanup-snapshots`: Cron (daily). Prunes old pool snapshots, keeping hourly samples for data older than 7 days.

**Schema management**: Drizzle ORM defines the schema in [`frontend/src/db/schema.ts`](frontend/src/db/schema.ts). Migrations are generated with `bunx drizzle-kit generate` and applied with `bunx drizzle-kit push`.

**Fallback**: If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set, the frontend falls back to direct Aleo explorer API calls.

## 7. Testing

### 7.1 Contract Tests

From the `tests/` directory:

```bash
bun test
```

Test suites:

- **`contract/transitions.test.ts`**: Validates transition inputs and outputs using `leo run` (no proofs, fast). Tests all 15 transitions including `place_bet`, `claim_winnings`, `resolve_with_oracle`, and input validation (e.g., rejects bets below `MIN_BET` of 1,000 microcredits).

- **`unit/payout-math.test.ts`**: Verifies the parimutuel payout formula matches the contract's `finalize_claim_winnings` logic exactly. Covers equal pools, skewed pools (99:1), sole winners, losers, minimum bets, integer truncation, and `u128` overflow scenarios.

- **`integration/zk-integration.test.ts`**: Tests Pedersen commitment generation, aggregate verification, and the full place-bet-to-resolve lifecycle with homomorphic commitment aggregation.

### 7.2 Frontend Tests

From the `frontend/` directory:

```bash
bun test
```

Tests use Vitest and cover:

- **`lib/__tests__/aleo.test.ts`**: `calculatePayout`, `formatCredits`, `formatPool`, `getAllMarketIds`, `getOracleAttestedData`, `getAdminAddress`, `getMarketCount`, `estimateBlockHeight`. Mock-based tests for all chain-query functions.

- **`lib/__tests__/marketRegistry.test.ts`**: Market metadata CRUD operations via localStorage with Supabase fallback.

- **`lib/__tests__/oraclePresets.test.ts`**: Oracle preset configuration validation.

**84 tests passing**: contract transitions, payout math, frontend units, ZK integration.

## 8. Project Structure

```
private-prediction-market/
├── contracts/
│   └── prediction_market/
│       ├── src/main.leo              # Contract source (801 lines)
│       ├── program.json              # Program ID and dependencies
│       └── build/                    # Compiled Aleo instructions
├── frontend/
│   ├── src/
│   │   ├── components/               # React UI components
│   │   │   ├── MarketList.tsx         # Market grid with Supabase query
│   │   │   ├── MarketCard.tsx         # Individual market display
│   │   │   ├── BetModal.tsx           # Privacy-aware bet flow
│   │   │   ├── ClaimModal.tsx         # Claim winnings
│   │   │   ├── RefundModal.tsx        # Cancelled market refunds
│   │   │   ├── CreateMarketModal.tsx  # Admin market creation
│   │   │   └── OracleResolveModal.tsx # Oracle resolution
│   │   ├── hooks/
│   │   │   ├── useMarkets.ts          # Supabase + chain cross-reference
│   │   │   ├── useAdmin.ts            # On-chain admin check
│   │   │   ├── useUserPositions.ts    # Wallet record decryption
│   │   │   ├── useMarketHistory.ts    # Market event history
│   │   │   └── usePlatformStats.ts    # Platform-wide statistics
│   │   ├── lib/
│   │   │   ├── aleo.ts               # Chain queries and payout math
│   │   │   ├── supabase.ts           # Supabase client and helpers
│   │   │   └── marketRegistry.ts     # Market metadata CRUD
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle ORM table definitions
│   │   │   └── types.ts              # Inferred TypeScript types
│   │   └── pages/
│   │       └── MarketDetailPage.tsx   # Single market detail view
│   ├── supabase/
│   │   ├── migrations/               # Generated SQL from Drizzle
│   │   └── functions/                # Edge Functions
│   └── package.json
├── tests/
│   ├── contract/                     # Leo transition tests
│   ├── unit/                         # Payout math tests
│   ├── integration/                  # ZK integration tests
│   └── helpers/                      # Test utilities
├── scripts/
│   ├── deploy.sh                     # Contract deployment
│   └── create_market.sh              # Market creation helper
├── .env.example                      # Required environment variables
└── README.md
```

## 9. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Smart contract | Leo | 3.4.0 |
| Contract deps | `credits.aleo`, `official_oracle_v2.aleo` | Testnet Beta |
| Frontend | React | 18.3.1 |
| Build tool | Vite | 7.2.4 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.1.18 |
| Wallet adapter | `@provablehq/aleo-wallet-adaptor-*` | 0.3.0-alpha.3 |
| ZK SDK | `@provablehq/sdk` | 0.9.15 |
| Oracle SDK | `@zkportal/aleo-oracle-sdk` | 2.1.1 |
| Data fetching | `@tanstack/react-query` | 5.90.20 |
| Database | Supabase (PostgreSQL) | - |
| ORM | Drizzle | 0.45.1 |
| Animations | GSAP | 3.14.2 |
| Router | react-router-dom | 7.13.0 |
| Package manager | Bun | - |
| Test runner | Vitest | 4.0.18 |
| Hosting | Vercel | - |

## 10. Acknowledgments

- [PriceProof](https://github.com/bendyarm/priceproof) - parimutuel prediction market reference implementation by an Aleo core contributor. Informed the singleton mapping pattern and claim-before-verify approach.
- [Aleo Privacy Buildathon](https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo) - for the platform and support.
- [Shield Wallet](https://shieldwallet.app/) by Provable - wallet integration with delegated proving.
- [zkPortal Oracle](https://zkportal.io/) - attested data feeds for oracle-based resolution.

## 11. License

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
