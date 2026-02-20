<p align="center">
    <h1 align="center">🍝 Lasagna</h1>
    <p align="center">A private prediction market on Aleo with deferred aggregate revelation — bet direction is fully private, pool totals hidden until resolution.</p>
</p>

<p align="center">
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-blue.svg"></a>
    <a href="https://developer.aleo.org/"><img src="https://img.shields.io/badge/Aleo-Testnet_Beta-1E1E2E"></a>
    <a href="https://discord.gg/aleo"><img src="https://img.shields.io/discord/700454073459015690?logo=discord"></a>
</p>

<p align="center">
    <b>Live Demo:</b> <a href="https://lasagna-markets.vercel.app">lasagna-markets.vercel.app</a> · <b>Contract:</b> <code>prediction_market_test007.aleo</code> · <b>84 tests passing</b>
</p>

## Overview

Lasagna is a parimutuel prediction market where users bet on binary (YES/NO) outcomes using Aleo credits. Unlike traditional prediction markets where every trade is public, Lasagna keeps bet directions fully private using Pedersen commitments and hides pool totals until resolution via **Deferred Aggregate Revelation (DAR)**.

Winners split the opposing pool proportionally, minus a 2% fee. Bet records are encrypted Aleo records — an observer can see that *someone* placed a bet in a given tier, but cannot determine which wallet placed it or which direction they chose.

Built for the [Aleo Privacy Buildathon](https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo).

## Privacy Model

Privacy is the core innovation. Wave 1 had a critical flaw: bet direction (`outcome: bool`) was a public finalize argument, and pool totals updated on every bet. An observer could see exactly who bet what. Wave 2 fixes this completely with **Deferred Aggregate Revelation (DAR)**.

### How DAR Works

1. **Private Bet Placement**
   - Users place bets with a **private** `outcome` (YES/NO) and a random **private** `nonce_value` (scalar blinding factor).
   - A Pedersen commitment is computed: `commitment = amount * G + nonce_value * H`, where:
     - `G = group::GEN` (standard group generator)
     - `H = Poseidon2::hash_to_group(0field)` (nothing-up-my-sleeve point)
   - This scheme is **additively homomorphic**: `commit(a, r1) + commit(b, r2) = commit(a+b, r1+r2)`.
   - The commitment is added to the on-chain aggregate (`yes_aggregate_commit` or `no_aggregate_commit`) via group addition in finalize.
   - Pool totals (`yes_pool`, `no_pool`) are **never updated during betting** — they stay at zero.

2. **Aggregate Hiding**
   - Only aggregate commitments (group elements) are public. Individual bet directions and amounts are indistinguishable.
   - Fixed denomination tiers (1K, 5K, 10K, 50K, 100K microcredits) enforce indistinguishability within tiers.

3. **Resolution & Revelation**
   - Admin calls `resolve_market` with the outcome, pool totals, and summed blinding factors.
   - The contract verifies: `yes_pool_amount * G + yes_blinding_sum * H == yes_aggregate_commit[market_id]` (and same for NO).
   - Only upon successful verification are pool totals set and the market resolved.
   - This deferred revelation prevents real-time sentiment tracking, front-running, and manipulation.

4. **Dispute Mechanism**
   - Post-resolution, a dispute window allows bettors to submit ZK proofs of bet ownership via `submit_bet_proof`.
   - If disputes reach a threshold, the admin resolves via `resolve_disputed`.

### Privacy Table

| Data | Visibility | Notes |
|------|-----------|-------|
| Market existence, status, outcome | Public | On-chain mappings |
| Pool totals (YES/NO) | **Hidden until resolution** | Only set in `resolve_market` finalize |
| Bet direction (YES/NO) | **Private** | Pedersen commitment only; never in finalize args |
| Bet amount | Public | Fixed denomination tiers for indistinguishability |
| Bettor identity (wallet) | **Private** | Encrypted in Bet record |
| Aggregate commitments | Public | `yes_aggregate_commit`, `no_aggregate_commit` (group elements) |
| Individual blinding factors | **Private** | Client-side only |

### Why DAR > Commit-Reveal

- **Single transaction UX** — no multi-phase commit/reveal dance
- **No real-time leakage** — pools frozen during betting, no sentiment signal
- **Homomorphic efficiency** — aggregates without per-bet revelations
- **Stronger anonymity** — bet directions are private forever, not just temporarily hidden

## Smart Contract

### Program Details

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

### Transitions

**User transitions** (permissionless):

| Transition | Privacy | Description |
|-----------|---------|-------------|
| `place_bet(market_id, outcome, amount, nonce_value)` | outcome + nonce **private** | Place a bet. Adds Pedersen commitment to aggregate. Returns encrypted `Bet` record. |
| `add_to_bet(existing_bet, additional_amount, nonce_value)` | bet record **private** | Add funds to existing bet. Consumes old record, returns combined. |
| `claim_winnings(bet, claimed_amount)` | bet record **private** | Claim payout after resolution. Contract verifies amount. |
| `claim_refund(bet)` | bet record **private** | Full refund for cancelled markets. |
| `submit_bet_proof(bet)` | ZK proof of ownership | Submit proof during dispute window. |
| `resolve_with_oracle(market_id)` | all public | Permissionless oracle resolution via zkPortal attested data. |

**Admin transitions**:

| Transition | Description |
|-----------|-------------|
| `initialize(admin_address)` | One-time admin setup |
| `create_market(market_id, end_time, yes_label, no_label)` | Create market, register in global index |
| `close_betting(market_id)` | Stop accepting bets |
| `resolve_market(market_id, outcome, yes_pool, no_pool, yes_blinding, no_blinding)` | Verify commitments, set pools, resolve |
| `resolve_disputed(market_id, outcome, yes_pool, no_pool, yes_blinding, no_blinding)` | Resolve after dispute window |
| `cancel_market(market_id)` | Cancel market, enable refunds |
| `withdraw_fees(market_id, claimed_fee_amount)` | Withdraw 2% platform fee |
| `set_operator(operator_address)` | Delegate close/pause permissions |
| `pause_market(market_id)` / `unpause_market(market_id)` | Emergency controls |
| `set_market_oracle(market_id, threshold, request_hash)` | Configure oracle parameters |

### Market Lifecycle

```
    ┌──────────────┐
    │ create_market │
    └──────┬───────┘
           ▼
    ┌──────────────┐   pause/unpause
    │   OPEN (0)   │◄──────────────►
    │  accept bets │
    └──────┬───────┘
           │ close_betting
           ▼
    ┌──────────────┐
    │  CLOSED (1)  │──── cancel ────►┐
    │  no new bets │                 │
    └──────┬───────┘                 │
           │ resolve_market          │
           │ (verify commitments)    │
           ▼                         ▼
    ┌──────────────┐         ┌──────────────┐
    │ RESOLVED (2) │         │CANCELLED (3) │
    │ claim_winnings│         │ claim_refund │
    │ (dispute →   │         └──────────────┘
    │  re-resolve) │
    └──────────────┘
```

## Frontend

The frontend is a React SPA with Shield Wallet integration for delegated ZK proof generation.

### Key Features
- **Privacy-aware betting UI** — no pool totals or odds shown during open markets ("Revealed at resolution")
- **Shield Wallet** — delegated proving via `@provablehq/aleo-wallet-adaptor-*` (no client-side WASM)
- **Chain as source of truth** — cross-references on-chain status for closed/resolved markets, with sessionStorage-backed high-water-mark to prevent stale data flicker
- **Auto-close expired markets** — client-side derivation + server-side `close_expired_markets` RPC
- **Admin-only resolve** — `useAdmin` hook checks on-chain admin address
- **GSAP animations** — smooth card entrance and page transitions
- **Countdown timers** — human-readable dates with live countdowns

### Local Development

```bash
cd frontend
bun install
bun dev
```

Dev server at `http://localhost:5173`. Requires `Cross-Origin-Opener-Policy` headers for WASM `SharedArrayBuffer`.

### Supabase Backend

Market metadata and chain state caching via Supabase. If `VITE_SUPABASE_URL` is not set, falls back to direct Aleo explorer API calls.

**Tables**: `markets`, `categories`, `pool_snapshots`, `platform_stats`, `user_positions`, `market_blindings`

**Edge Functions**: `index-markets` (chain indexer), `create-market-metadata` (metadata storage), `cleanup-snapshots` (data pruning)

## Build & Deploy

### Requirements

- [Leo](https://developer.aleo.org/leo/) v3.4.0+
- [Bun](https://bun.sh/) v1.0+
- [Shield Wallet](https://shieldwallet.app/) browser extension
- Testnet credits from the [Aleo Faucet](https://faucet.aleo.org/)

### Build the Contract

```bash
cd contracts/prediction_market
leo build
```

### Deploy to Testnet

```bash
./scripts/deploy.sh testnet --init
```

### Run Tests

```bash
# Contract tests (from tests/ directory)
cd tests && bun test

# Frontend tests
cd frontend && bun test
```

**84 tests passing**: contract transitions, payout math, frontend units, ZK integration.

## Project Structure

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
│   └── integration/                  # ZK integration tests
├── scripts/
│   ├── deploy.sh                     # Contract deployment
│   └── create_market.sh              # Market creation helper
└── README.md
```

## Tech Stack

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
| Database | Supabase (PostgreSQL) | — |
| ORM | Drizzle | 0.45.1 |
| Animations | GSAP | 3.14.2 |
| Router | react-router-dom | 7.13.0 |
| Package manager | Bun | — |
| Test runner | Vitest | 4.0.18 |
| Hosting | Vercel | — |

## Acknowledgments

- [PriceProof](https://github.com/bendyarm/priceproof) — parimutuel prediction market reference implementation by an Aleo core contributor. Informed the singleton mapping pattern and claim-before-verify approach.
- [Aleo Privacy Buildathon](https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo) — for the platform and support.
- [Shield Wallet](https://shieldwallet.app/) by Provable — wallet integration with delegated proving.
- [zkPortal Oracle](https://zkportal.io/) — attested data feeds for oracle-based resolution.

## License

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)
