#!/bin/bash

# Create a new prediction market
# Usage: ./scripts/create_market.sh <market_id> "<question>"

set -e

MARKET_ID=${1:-1field}
QUESTION=${2:-"Will this test market resolve to YES?"}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
    export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

# Validate required variables
if [ -z "$ADMIN_PRIVATE_KEY" ]; then
    echo "Error: ADMIN_PRIVATE_KEY not set in .env"
    exit 1
fi

NETWORK=${VITE_NETWORK:-testnet}
API_ENDPOINT="https://api.explorer.provable.com/v1"
BROADCAST_ENDPOINT="https://api.explorer.provable.com/v1/$NETWORK/transaction/broadcast"
FEE=${PRIORITY_FEE:-100000}
PROGRAM_ID=${VITE_PROGRAM_ID:-prediction_market.aleo}

echo "============================================"
echo "Creating Market"
echo "Network: $NETWORK"
echo "Market ID: $MARKET_ID"
echo "Question: $QUESTION"
echo "============================================"

# Execute create_market transition
snarkos developer execute "$PROGRAM_ID" create_market \
    "$MARKET_ID" \
    --private-key "$ADMIN_PRIVATE_KEY" \
    --query "$API_ENDPOINT" \
    --broadcast "$BROADCAST_ENDPOINT" \
    --priority-fee "$FEE"

echo "============================================"
echo "Market created!"
echo "============================================"
