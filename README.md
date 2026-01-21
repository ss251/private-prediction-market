# Private Prediction Market

A zero-knowledge prediction market built on Aleo where your bet positions remain private while pool totals are transparent.

## Why Privacy Matters

On traditional prediction markets (like Polymarket), every trade is public:
- Your positions are visible to everyone
- Front-running is possible
- Your betting patterns can be analyzed

With Aleo's programmable privacy, we can do better:
- **Private bet direction**: No one knows if you bet YES or NO
- **Private identity**: Your address isn't linked to your bets
- **Transparent pools**: Market odds are still visible for fair pricing

## Features

- Binary (YES/NO) prediction markets
- Parimutuel betting (pool-based, winners split the pot)
- Private bet positions via Aleo records
- Public pool totals for price discovery
- Admin-controlled market resolution (oracle integration in v2)

## Tech Stack

- **Smart Contract**: Leo (Aleo's ZK programming language)
- **Testing**: DokoJS
- **Frontend**: React + Vite + TypeScript
- **Wallet**: Leo Wallet, Puzzle Wallet, Fox Wallet

## Quick Start

### Prerequisites
- [Leo CLI](https://developer.aleo.org/leo/)
- [Bun](https://bun.sh/)
- [Aleo Testnet Faucet](https://faucet.aleo.org/) for test credits

### Installation
```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/private-prediction-market.git
cd private-prediction-market

# Install dependencies
bun install

# Copy environment variables
cp .env.example .env
# Edit .env with your keys
```

### Run Tests
```bash
# Unit tests (fast, no proofs)
bun test

# Integration tests (with proofs)
bun test:integration
```

### Local Development
```bash
# Start frontend
cd frontend
bun dev
```

### Deploy to Testnet
```bash
# Build contract
cd contracts/prediction_market
leo build

# Deploy (requires ~2 ALEO)
./scripts/deploy.sh
```

## Project Structure

```
private-prediction-market/
├── ai/                    # AI context files
├── contracts/             # Leo smart contracts
│   └── prediction_market/
├── frontend/              # React app
├── tests/                 # DokoJS tests
├── scripts/               # Deployment scripts
└── .github/workflows/     # CI/CD
```

## How It Works

### Place a Bet
1. Connect your wallet
2. Select a market
3. Choose YES or NO
4. Enter bet amount
5. Confirm transaction (proof generation takes ~30-60s)
6. Receive private Bet record

### Claim Winnings
1. Wait for market resolution
2. Your frontend calculates your payout
3. Submit claim transaction
4. Contract verifies calculation
5. Receive winnings

## Privacy Model

| Data | Visibility |
|------|------------|
| Market existence | Public |
| Pool totals | Public |
| Your bet direction | **Private** |
| Your identity | **Private** |
| Your total position | **Private** |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## License

MIT

## Acknowledgments

- [PriceProof](https://github.com/bendyarm/priceproof) by Aleo core contributor - parimutuel reference implementation
- [Aleo Privacy Buildathon](https://app.akindo.io/wave-hacks/gXdXJvJXxTJKBELvo) - hackathon sponsor
