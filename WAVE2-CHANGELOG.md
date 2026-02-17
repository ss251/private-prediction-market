# Wave 2 Changelog — Lasagna (Private Prediction Market)

## What we built this wave

### 🔒 Deferred Aggregate Revelation (Privacy Architecture Upgrade)
The single biggest privacy improvement possible on Aleo prediction markets.

**Problem**: Every Aleo prediction market (including Veiled Markets) updates pool totals inside the user's `place_bet` finalize block. This leaks bet direction and amount as public finalize arguments in every single transaction.

**Our solution**: Pool totals are **never updated on-chain during betting**. The `place_bet` finalize only checks market status and increments a public `bet_count` — no direction, no amount. Live odds are tracked off-chain in Supabase. Pool totals are only published on-chain at resolution time via `resolve_market(market_id, outcome, total_yes, total_no)`.

**Privacy surface comparison**:
| Aspect | Standard (Veiled Markets etc.) | Lasagna (Deferred) |
|--------|-------------------------------|-------------------|
| Bet direction in finalize | ✗ Public every bet | ✓ Never on-chain |
| Bet amount in finalize | ✗ Public every bet | ✓ Never on-chain |
| Live pool totals on-chain | ✗ Updated every bet | ✓ Only at resolution |
| Bet record fields | Encrypted (standard) | Encrypted (standard) |

**What's private**: Bet direction (encrypted in Bet record, never in finalize args), bettor identity (wallet never linked to bet), pool composition during betting.

**What's public**: Bet count per market, credit transfer amounts (visible in credits.aleo but not linked to direction), pool totals at resolution, market outcome.

### Shield Wallet Integration (Mandatory)
- Migrated from `@demox-labs/aleo-wallet-adapter-*` to `@provablehq/aleo-wallet-adaptor-*` (v0.3.0-alpha.3)
- ShieldWalletAdapter is the primary wallet
- Updated 15 frontend files for new API pattern

### Supabase-Indexed User Positions
- New `user_positions` table tracks bets without wallet popups (`requestRecords()`)
- `useUserPositions` hook queries Supabase REST instead of decrypting on-chain records
- `incrementPoolTotal()` updates market aggregates in Supabase on bet confirmation

### Pool History Charts
- `PoolHistoryChart` component using Recharts
- Reads from `pool_snapshots` Supabase table
- Displayed on market detail pages

### Privacy Disclosure
- Honest, transparent breakdown of what's private vs public
- References Aleo's execution model limitations
- Links to on-chain contract for verification

### Oracle Investigation
- Investigated all oracle options: zkPortal (dead since April 2025), Snorkle (0 calls), Veru (mainnet only)
- Decision: Manual resolution for now, contract interface is oracle-swappable

## Wave 2.1 Privacy Upgrades

### 🔗 BHP256 Aggregate Commitment Scheme
Added a running hash chain of bet commitments, enabling independent verification of pool totals at resolution without revealing individual bet data.

**How it works:**
- New mapping: `aggregate_commitment: field => field` (market_id => running hash)
- On each `place_bet` and `add_to_bet`, the transition computes `bet_commit = BHP256::hash_to_field(bet)` from the private Bet record
- `bet_commit` is passed as a PUBLIC finalize arg (it's a hash — hides amount, outcome, and owner)
- Finalize chains it: `updated = BHP256::hash_to_field(current_agg + bet_commit)` and stores
- After resolution, anyone with access to the original Bet records can reconstruct the aggregate and verify it matches the on-chain value
- If admin manipulates pool totals, the reconstructed aggregate won't match → provable fraud

**Privacy properties:**
- `bet_commit` is one-way: cannot recover bet.outcome or bet.amount from it
- The aggregate is deterministic: same bets in same order = same root
- Each market has an independent commitment chain

### 🔒 Private Credits Consumption (ROADMAP)
Investigated replacing `transfer_public_as_signer` with private credits record consumption to eliminate on-chain transfer amount visibility.

**Finding:** Leo does not allow programs to consume or produce records defined by external programs (`credits.aleo`). Only the defining program can create/destroy its own records. Alternative patterns (`credits.aleo/transfer_private` to program address) also don't work because the program can't hold private record state.

**Status:** Documented as a roadmap item. Requires either:
1. Aleo protocol support for cross-program record consumption
2. A wrapper pattern where credits.aleo provides a `burn`/`mint` interface
3. Move to a token standard that supports private escrow natively

Current approach (fixed tiers + `transfer_public_as_signer`) remains the best available privacy tradeoff.

## Contract Changes (prediction_market_test004.aleo)
- `place_bet`: Finalize only checks status + increments `bet_count` (no outcome/amount args)
- `add_to_bet`: Same — no pool updates in finalize
- `resolve_market`: Now takes `total_yes` + `total_no` as public args (deferred from betting)
- `resolve_with_oracle`: Same — pool totals passed at resolution
- New mapping: `bet_count: field => u64`
- Removed: Real-time pool updates from user transitions
- Stripped commit-reveal betting (added complexity without true direction privacy)

## Privacy Hardening (3 Concerns Addressed)

### Concern 1 — Claim Finalize Leak Fix (HIGH PRIORITY)
**Problem**: `claim_winnings` finalize received `bet_outcome` and `bet_amount` as public args, leaking the claimer's direction and size.

**Fix**: Payout calculation moved entirely into the transition (ZK circuit) which has private access to bet fields. The transition:
- Asserts `bet.outcome == winning_outcome` (ZK proof the bet won — losers can't call it)
- Computes payout from private `bet.amount` + public pool data
- Calls `credits.aleo/transfer_public(bet.owner, payout)`

Finalize ONLY verifies that the public args (`winning_outcome`, `total_yes`, `total_no`) match on-chain mappings. It **never sees** `bet_outcome` or `bet_amount`.

### Concern 2 — Admin Trust / Dispute Mechanism (HIGH PRIORITY)
**Problem**: Admin was the sole source of pool totals at resolution (from Supabase), with no way to challenge incorrect values.

**Fix**: Added a dispute mechanism:
- New `submit_bet_proof(bet: Bet)` transition — users submit their private bet records during a dispute window to prove they have real bets
- `DISPUTE_BLOCKS = 1000` (~few hours) window after resolution
- If `dispute_count >= DISPUTE_THRESHOLD (5)`, market enters `STATUS_DISPUTED (4)`
- New `resolve_disputed()` admin function to re-resolve with corrected totals
- `claim_winnings` blocked until dispute window closes
- New mappings: `dispute_window_end`, `dispute_count`, `bet_submitted`

### Concern 3 — Public Bet Sizes (MEDIUM)
**Problem**: `transfer_public_as_signer` reveals exact amounts. While direction is hidden, unique amounts could be correlated.

**Fix**: Fixed denomination betting tiers — bets must be exactly one of:
- `TIER_1: 1000`, `TIER_2: 5000`, `TIER_3: 10000`, `TIER_4: 50000`, `TIER_5: 100000` microcredits
- Both `place_bet` and `add_to_bet` enforce tier validation
- Makes transfers indistinguishable within each tier — observer sees "someone bet 10000 on *something*" but can't link to direction
- Users wanting larger bets place multiple tier bets (separate transactions)

## Deployed
- Contract: `prediction_market_test004.aleo` on Testnet Beta
- Frontend: https://lasagna-markets.vercel.app
- GitHub: https://github.com/ss251/private-prediction-market

## Tech Stack
- Leo (Aleo), credits.aleo, official_oracle_v2.aleo (interface)
- React 18, TypeScript 5.9, Vite 7, @provablehq/sdk 0.9.15
- @provablehq/aleo-wallet-adaptor-shield (Wave 2)
- Supabase (positions + pool aggregates), Drizzle ORM, Recharts
- TanStack React Query, Tailwind CSS 4
