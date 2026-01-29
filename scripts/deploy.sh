#!/bin/bash

# Deploy prediction_market.aleo to Aleo network
# Usage: ./scripts/deploy.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACT_DIR="$PROJECT_ROOT/contracts/prediction_market"

# Load environment variables from contract .env
if [ -f "$CONTRACT_DIR/.env" ]; then
    export $(grep -v '^#' "$CONTRACT_DIR/.env" | xargs)
fi
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Use PRIVATE_KEY or ADMIN_PRIVATE_KEY
DEPLOY_KEY="${PRIVATE_KEY:-$ADMIN_PRIVATE_KEY}"
if [ -z "$DEPLOY_KEY" ]; then
    echo "Error: PRIVATE_KEY or ADMIN_PRIVATE_KEY not set in .env"
    exit 1
fi

# Read program name from program.json
PROGRAM_NAME=$(python3 -c "import json; print(json.load(open('$CONTRACT_DIR/program.json'))['program'])" 2>/dev/null || echo "prediction_market_test003.aleo")

# Set network endpoints
if [ "$NETWORK" = "mainnet" ]; then
    API_ENDPOINT="https://api.explorer.provable.com/v1"
    BROADCAST_ENDPOINT="https://api.explorer.provable.com/v1/mainnet/transaction/broadcast"
    FEE=${PRIORITY_FEE:-3000000}
else
    API_ENDPOINT="https://api.explorer.provable.com/v1"
    BROADCAST_ENDPOINT="https://api.explorer.provable.com/v1/testnet/transaction/broadcast"
    FEE=${PRIORITY_FEE:-1900000}
fi

echo "============================================"
echo "Deploying $PROGRAM_NAME"
echo "Network: $NETWORK"
echo "Fee: $FEE microcredits"
echo "============================================"

# Build first
echo "Building contract..."
cd "$CONTRACT_DIR"
leo build

# Deploy
echo "Deploying..."
snarkos developer deploy "$PROGRAM_NAME" \
    --private-key "$DEPLOY_KEY" \
    --query "$API_ENDPOINT" \
    --broadcast "$BROADCAST_ENDPOINT" \
    --priority-fee "$FEE"

echo "============================================"
echo "Deployment complete!"
echo "============================================"
