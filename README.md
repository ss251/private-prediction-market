<p align="center">
    <h1 align="center">Private Prediction Market</h1>
    <p align="center">A parimutuel prediction market on Aleo where bettor identity is private and pool totals are public.</p>
</p>

<p align="center">
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
    <a href="https://developer.aleo.org/"><img src="https://img.shields.io/badge/Aleo-Testnet_Beta-1E1E2E"></a>
    <a href="https://discord.gg/aleo"><img src="https://img.shields.io/discord/700454073459015690?logo=discord"></a>
</p>

## Table of Contents

* [1. Overview](#1-overview)
* [2. Architecture](#2-architecture)
    * [2.1 Privacy Model](#21-privacy-model)
    * [2.2 Parimutuel Mechanics](#22-parimutuel-mechanics)
    * [2.3 Market Lifecycle](#23-market-lifecycle)
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

Users bet on binary (YES/NO) outcomes. Credits are pooled per side. After resolution, winners split the opposing pool proportionally, minus a 2% fee. Bet records are encrypted Aleo records — the chain reveals bet direction, amount, and pool totals, but not which wallet placed a given bet.

The contract is deployed on Aleo Testnet Beta as `prediction_market_test004.aleo`. It depends on `credits.aleo` for native credit transfers and `official_oracle_v2.aleo` for attested data feeds.

## 2. Architecture

```
┌─────────────────────┐      ┌────────────────────────┐
│  Frontend (React)   │─────▶│  Aleo Testnet Beta     │
│  Wallet Adapter     │      │  prediction_market_     │
│  ZK Proof Gen       │      │  test004.aleo          │
└────────┬────────────┘      └──────────┬─────────────┘
         │                              │
         │  metadata                    │  on-chain state
         ▼                              ▼
┌─────────────────────┐      ┌────────────────────────┐
│  Supabase           │◀─────│  Indexer Edge Function  │
│  PostgreSQL + REST  │      │  (polls chain every 60s)│
│  + Realtime WS      │      └────────────────────────┘
└─────────────────────┘
```

The frontend generates ZK proofs client-side via `@provablehq/sdk` WASM workers. Proof generation takes 30–60 seconds. Market metadata (title, description, category) is stored in Supabase. On-chain state (pools, status, outcome) is indexed by a cron Edge Function and served to the frontend via a single REST query. If Supabase is unavailable, the frontend falls back to direct Aleo explorer API calls.

### 2.1 Privacy Model

| Data | Visibility | Stored In |
|------|-----------|-----------|
| Market existence, status, outcome | Public | On-chain mappings |
| Pool totals (YES/NO aggregate) | Public | On-chain mappings |
| Market end time, creator address | Public | On-chain mappings |
| Bet direction (YES or NO) | **Public** | Finalize arguments (on-chain) |
| Individual bet amount | **Public** | Transition input (on-chain) |
| Bettor identity (wallet address) | **Private** | Not in finalize args; encrypted in Bet record |
| Payout amount per user | **Private until claim** | Revealed at claim time |

**What is private**: The bettor's wallet address is never linked to a bet in finalize arguments or public mappings. An observer can see "someone bet YES with 10,000 microcredits on market 3" but cannot determine which address placed it. The `Bet` record containing the owner address is stored encrypted on-chain; only the record owner can decrypt it.

**What is public**: Bet direction is passed to the finalize block (which updates either `yes_pool` or `no_pool`), so it appears in plaintext in the transaction's future output. Bet amount is a public transition input. This is an inherent constraint — finalize arguments on Aleo are always public.

**Why this matters**: On EVM prediction markets, every trade is linked to a wallet address. Participants can be identified, front-run, and profiled. On Aleo, the identity link is broken — you cannot build a profile of who bet what. The privacy guarantee is **anonymity**, not bet secrecy.

**Limitation**: A commit-reveal pattern could also hide bet direction by batching reveals, breaking timing correlation between individual bets and pool changes. This is planned for a future version.

### 2.2 Parimutuel Mechanics

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

### 2.3 Market Lifecycle

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
           │ resolve_with_oracle            │
           ▼                                ▼
    ┌──────────────┐                ┌──────────────┐
    │ RESOLVED (2) │                │CANCELLED (3) │
    │ claim_winnings│                │ claim_refund │
    │ withdraw_fees │                └──────────────┘
    └──────────────┘
```

Markets can also be cancelled directly from OPEN state via `cancel_market`.

## 3. Smart Contract

### 3.1 Program Details

| Field | Value |
|-------|-------|
| Program ID | `prediction_market_test004.aleo` |
| Leo version | 3.4.0 |
| Network | Testnet Beta |
| Dependencies | `credits.aleo`, `official_oracle_v2.aleo` |
| Minimum bet | 1,000 microcredits (0.001 credits) |
| Fee rate | 200 basis points (2%) |
| Source | [`contracts/prediction_market/src/main.leo`](contracts/prediction_market/src/main.leo) |

### 3.2 Record Types

The contract defines one private record:

```leo
record Bet {
    owner: address,      // bettor address (private)
    market_id: field,    // which market (private)
    outcome: bool,       // true = YES, false = NO (private)
    amount: u64,         // bet size in microcredits (private)
}
```

A `Bet` record is created by `place_bet` or `add_to_bet`, and consumed (spent) by `claim_winnings` or `claim_refund`. Consuming the record prevents double-claims.

### 3.3 Public Mappings

**Market state:**

| Mapping | Type | Description |
|---------|------|-------------|
| `market_status` | `field => u8` | 0=OPEN, 1=CLOSED, 2=RESOLVED, 3=CANCELLED |
| `yes_pool` | `field => u64` | Aggregate credits bet on YES |
| `no_pool` | `field => u64` | Aggregate credits bet on NO |
| `market_outcome` | `field => bool` | Winning outcome after resolution |
| `market_end_time` | `field => u32` | Block height deadline for betting |
| `market_paused` | `field => bool` | Emergency pause flag |
| `market_creator` | `field => address` | Address that created the market |
| `market_yes_label` | `field => field` | Hash of YES outcome label |
| `market_no_label` | `field => field` | Hash of NO outcome label |

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

**Admin transitions** (require admin or operator role):

| Transition | Access | Description |
|-----------|--------|-------------|
| `initialize(admin_address)` | Once | Set the admin address. Cannot be called twice. |
| `create_market(market_id, end_time, yes_label_hash, no_label_hash)` | Admin | Create a new market. Registers it in the global index. |
| `close_betting(market_id)` | Admin/Operator | Stop accepting bets. Required before resolution. |
| `resolve_market(market_id, outcome)` | Admin | Manually resolve to YES or NO. Calculates fees. |
| `cancel_market(market_id)` | Admin | Cancel market (OPEN or CLOSED). Enables refunds. |
| `withdraw_fees(market_id, claimed_fee_amount)` | Admin | Withdraw 2% fee. Transfers credits to admin. |
| `set_operator(operator_address)` | Admin | Delegate close/pause permissions. |
| `pause_market(market_id)` | Admin/Operator | Emergency pause. Blocks new bets. |
| `unpause_market(market_id)` | Admin/Operator | Resume paused market. |
| `set_market_oracle(market_id, threshold, request_hash)` | Admin | Configure oracle parameters before close. |

**User transitions** (permissionless):

| Transition | Privacy | Description |
|-----------|---------|-------------|
| `place_bet(market_id, outcome, amount)` | bettor identity is **private** | Place a new bet. Returns a `Bet` record. Outcome is a private transition input but becomes public in finalize args. Transfers credits via `credits.aleo/transfer_public_as_signer`. |
| `add_to_bet(existing_bet, additional_amount)` | bet record is **private** | Consolidate additional funds into an existing bet. Consumes old record, returns new one with combined amount. |
| `claim_winnings(bet, claimed_amount)` | bet record is **private** | Claim payout after resolution. Contract verifies the claimed amount. Consumes the record. |
| `claim_refund(bet)` | bet record is **private** | Full refund for cancelled markets. Consumes the record. |
| `resolve_with_oracle(market_id)` | all public | Permissionless oracle resolution. Reads attested data from `official_oracle_v2.aleo`. |

### 3.5 Oracle Integration

Markets can be configured for automatic resolution using [zkPortal](https://zkportal.io/) oracle data attested via SGX enclaves.

**Setup** (admin calls `set_market_oracle` while market is OPEN):
- `threshold`: Price value as `u128`. YES wins if the attested data is >= this value.
- `request_hash`: Identifier linking to the oracle data entry in `official_oracle_v2.aleo/sgx_attested_data`.

**Resolution** (anyone calls `resolve_with_oracle` after market is CLOSED):
1. Contract reads `AttestedData { data: u128, attestation_timestamp: u128 }` from the oracle program.
2. Compares `attested.data >= threshold`.
3. Sets outcome and marks market as RESOLVED.

This is permissionless — once oracle data is on-chain, any address can trigger resolution.

## 4. Build Guide

### 4.1 Requirements

- [Leo](https://developer.aleo.org/leo/) v3.4.0+
- [Bun](https://bun.sh/) v1.0+
- An Aleo wallet ([Leo Wallet](https://www.leo.app/), [Puzzle Wallet](https://puzzle.online/), or [Fox Wallet](https://foxwallet.com/))
- Testnet credits from the [Aleo Faucet](https://faucet.aleo.org/)

### 4.2 Installation

Clone the repository:

```bash
git clone https://github.com/YOUR_USERNAME/private-prediction-market.git
```

Move into the project directory:

```bash
cd private-prediction-market
```

Copy the environment template:

```bash
cp .env.example .env
```

Edit `.env` with your admin private key and address. The `.env.example` shows the required variables:

```
VITE_NETWORK=testnet
VITE_API_ENDPOINT=https://api.explorer.provable.com/v1
VITE_PROGRAM_ID=prediction_market_test004.aleo
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

The deploy script builds the contract and broadcasts the deployment transaction. A priority fee of 1,900,000 microcredits (~1.9 credits) is used by default on testnet.

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
    --private-key "$ADMIN_PRIVATE_KEY" \
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
    --private-key "$ADMIN_PRIVATE_KEY" \
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

**Tables**: `markets`, `categories`, `pool_snapshots`, `platform_stats`, `indexer_state`

**Edge Functions**:
- `index-markets`: Cron (every 60s). Reads on-chain state from the explorer API, upserts into `markets`, captures pool snapshots, updates platform stats.
- `create-market-metadata`: HTTP POST. Called by the frontend after a successful on-chain `create_market` transaction to store title, description, category, and tags.
- `cleanup-snapshots`: Cron (daily). Prunes old pool snapshots, keeping hourly samples for data older than 7 days.

**Schema management**: Drizzle ORM defines the schema in [`frontend/src/db/schema.ts`](frontend/src/db/schema.ts). Migrations are generated with `bunx drizzle-kit generate` and applied with `bunx drizzle-kit push`.

**Fallback**: If `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are not set, the frontend falls back to direct Aleo explorer API calls (the pre-Supabase behavior).

## 7. Testing

### 7.1 Contract Tests

From the `tests/` directory:

```bash
bun test
```

Test suites:

- **`contract/transitions.test.ts`**: Validates transition inputs and outputs using `leo run` (no proofs, fast). Tests all 15 transitions including `place_bet`, `claim_winnings`, `resolve_with_oracle`, and input validation (e.g., rejects bets below `MIN_BET` of 1,000 microcredits).

- **`unit/payout-math.test.ts`**: Verifies the parimutuel payout formula matches the contract's `finalize_claim_winnings` logic exactly. Covers equal pools, skewed pools (99:1), sole winners, losers, minimum bets, integer truncation, and `u128` overflow scenarios.

### 7.2 Frontend Tests

From the `frontend/` directory:

```bash
bun test
```

Tests use Vitest and cover:

- **`lib/__tests__/aleo.test.ts`**: `calculatePayout`, `formatCredits`, `formatPool`, `getAllMarketIds`, `getOracleAttestedData`, `getAdminAddress`, `getMarketCount`, `estimateBlockHeight`. Mock-based tests for all chain-query functions.

- **`lib/__tests__/marketRegistry.test.ts`**: Market metadata CRUD operations via localStorage with Supabase fallback.

- **`lib/__tests__/oraclePresets.test.ts`**: Oracle preset configuration validation.

## 8. Project Structure

```
private-prediction-market/
├── contracts/
│   └── prediction_market/
│       ├── src/main.leo              # Contract source (611 lines)
│       ├── program.json              # Program ID and dependencies
│       └── build/                    # Compiled Aleo instructions
├── frontend/
│   ├── src/
│   │   ├── components/               # React UI components
│   │   │   ├── MarketList.tsx         # Market grid with Supabase query
│   │   │   ├── MarketCard.tsx         # Individual market display
│   │   │   ├── BetModal.tsx           # Place bet flow
│   │   │   ├── ClaimModal.tsx         # Claim winnings flow
│   │   │   ├── RefundModal.tsx        # Cancelled market refunds
│   │   │   ├── CreateMarketModal.tsx  # Admin market creation
│   │   │   ├── OracleResolveModal.tsx # Oracle resolution
│   │   │   └── TransactionProgress.tsx# TX state machine UI
│   │   ├── hooks/
│   │   │   ├── useTransaction.ts      # TX lifecycle state machine
│   │   │   ├── useMarkets.ts          # Supabase market query + Realtime
│   │   │   ├── useUserPositions.ts    # Wallet record decryption
│   │   │   └── useBetRecords.ts       # Raw Bet record fetching
│   │   ├── lib/
│   │   │   ├── aleo.ts               # Chain queries and payout math
│   │   │   ├── supabase.ts           # Supabase client and typed helpers
│   │   │   └── marketRegistry.ts     # Metadata CRUD (Supabase + localStorage)
│   │   ├── db/
│   │   │   ├── schema.ts             # Drizzle ORM table definitions
│   │   │   └── types.ts              # Inferred TypeScript types
│   │   └── pages/
│   │       └── MarketDetailPage.tsx   # Single market view
│   ├── supabase/
│   │   ├── migrations/               # Generated SQL from Drizzle schema
│   │   └── functions/                # Edge Functions (indexer, metadata, cleanup)
│   ├── drizzle.config.ts             # Drizzle-kit configuration
│   ├── vercel.json                   # COOP/COEP headers and SPA rewrites
│   └── package.json
├── tests/
│   ├── contract/                     # Leo transition tests (leo run)
│   ├── unit/                         # Payout math tests
│   ├── integration/                  # Full lifecycle tests
│   └── helpers/                      # Test utilities (leo-runner, constants)
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
| Contract dependencies | `credits.aleo`, `official_oracle_v2.aleo` | Testnet Beta |
| Frontend framework | React | 18.3.1 |
| Build tool | Vite | 7.2.4 |
| Language | TypeScript | 5.9.3 |
| Styling | Tailwind CSS | 4.1.18 |
| Wallet adapter | `@demox-labs/aleo-wallet-adapter-*` | 0.0.22–0.0.36 |
| ZK SDK | `@provablehq/sdk` | 0.9.15 |
| Oracle SDK | `@zkportal/aleo-oracle-sdk` | 2.1.1 |
| Data fetching | `@tanstack/react-query` | 5.90.20 |
| Database | Supabase (PostgreSQL) | — |
| ORM | Drizzle | 0.45.1 |
| Worker threading | Comlink | 4.4.2 |
| Animations | GSAP | 3.14.2 |
| Package manager | Bun | — |
| Test runner | Vitest | 4.0.18 |
| Hosting | Vercel | — |

## 10. Acknowledgments

- [PriceProof](https://github.com/bendyarm/priceproof) — parimutuel prediction market reference implementation by an Aleo core contributor. Informed the singleton mapping pattern and claim-before-verify approach.
- [Aleo Wallet Adapter](https://github.com/demox-labs/aleo-wallet-adapter) by Demox Labs — wallet integration library.
- [zkPortal Oracle](https://zkportal.io/) — attested data feed used for oracle-based market resolution.
- [Aleo Privacy Buildathon](https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo)

## 11. License

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
