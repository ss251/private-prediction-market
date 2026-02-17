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

## Contract Changes (prediction_market_test004.aleo)
- `place_bet`: Finalize only checks status + increments `bet_count` (no outcome/amount args)
- `add_to_bet`: Same — no pool updates in finalize
- `resolve_market`: Now takes `total_yes` + `total_no` as public args (deferred from betting)
- `resolve_with_oracle`: Same — pool totals passed at resolution
- New mapping: `bet_count: field => u64`
- Removed: Real-time pool updates from user transitions
- Stripped commit-reveal betting (added complexity without true direction privacy)

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
