#!/bin/bash

# Deploy prediction_market.aleo to Aleo network
# Usage: ./scripts/deploy.sh [testnet|mainnet]

set -e

NETWORK=${1:-testnet}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CONTRACT_DIR="$PROJECT_ROOT/contracts/prediction_market"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Validate required variables
if [ -z "$ADMIN_PRIVATE_KEY" ]; then
    echo "Error: ADMIN_PRIVATE_KEY not set in .env"
    exit 1
fi

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
echo "Deploying prediction_market.aleo"
echo "Network: $NETWORK"
echo "Fee: $FEE microcredits"
echo "============================================"

# Build first
echo "Building contract..."
cd "$CONTRACT_DIR"
leo build

# Deploy
echo "Deploying..."
snarkos developer deploy prediction_market.aleo \
    --private-key "$ADMIN_PRIVATE_KEY" \
    --query "$API_ENDPOINT" \
    --broadcast "$BROADCAST_ENDPOINT" \
    --priority-fee "$FEE"

echo "============================================"
echo "Deployment complete!"
echo "============================================"
