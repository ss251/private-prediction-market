# Wave 2 Changelog — Lasagna (Private Prediction Market)

## What we built this wave

### Shield Wallet Integration (Mandatory)
- **Fully migrated** from `@demox-labs/aleo-wallet-adapter-*` to `@provablehq/aleo-wallet-adaptor-*` (v0.3.0-alpha.3)
- ShieldWalletAdapter is now the primary wallet
- Updated all 15 frontend files: components, hooks, modals
- New API pattern: `executeTransaction({program, function, inputs, fee})` replaces old `Transaction.createTransaction()` + `requestTransaction()` flow
- PR: https://github.com/ss251/private-prediction-market/pull/14

### Oracle Investigation & Decision
- Investigated all oracle options on Aleo (zkPortal, Snorkle, Veru)
- **Finding**: `official_oracle_v2.aleo` (zkPortal) is dead — last data April 2025. Snorkle also inactive (0 on-chain calls ever). Only Veru is active but mainnet-only and project-specific.
- **Decision**: Keep manual resolution for now. Contract interface is designed to be oracle-swappable — can plug in Snorkle/Veru when testnet support appears.
- The contract already supports both admin resolution and oracle resolution paths.

## What's not finished yet
- Oracle-resolved markets (blocked by lack of active testnet oracles — see above)
- Commit-reveal betting pattern (planned for Wave 3)
- Multi-outcome markets (planned for future waves)

## Deployed
- Contract: `prediction_market_test004.aleo` on Testnet Beta
- Frontend: https://lasagna-markets.vercel.app

## Tech Stack
- Leo 3.4.0, credits.aleo, official_oracle_v2.aleo (interface only)
- React 18, TypeScript 5.9, Vite 7, @provablehq/sdk 0.9.15
- @provablehq/aleo-wallet-adaptor-shield (NEW in Wave 2)
- Supabase, Drizzle ORM, TanStack React Query, Tailwind CSS 4
- 55 tests passing
