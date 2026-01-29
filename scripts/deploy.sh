#!/bin/bash

# Deploy prediction_market contract to Aleo network
# Usage: ./scripts/deploy.sh [testnet|mainnet] [--init]
#
# Options:
#   --init    Initialize contract after deploy (sets deployer as admin)

set -e

NETWORK=${1:-testnet}
INIT=false
for arg in "$@"; do
  [ "$arg" = "--init" ] && INIT=true
done

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
PROGRAM_NAME=$(python3 -c "import json; print(json.load(open('$CONTRACT_DIR/program.json'))['program'])" 2>/dev/null || echo "prediction_market_test004.aleo")

# Set fee
if [ "$NETWORK" = "mainnet" ]; then
    FEE=${PRIORITY_FEE:-3000000}
else
    FEE=${PRIORITY_FEE:-1900000}
fi

echo "============================================"
echo "Deploying $PROGRAM_NAME"
echo "Network: $NETWORK"
echo "Fee: $FEE microcredits"
echo "Init: $INIT"
echo "============================================"

# Build first
echo "Building contract..."
cd "$CONTRACT_DIR"
leo build

# Deploy using leo deploy (Leo 3.x)
echo "Deploying..."
leo deploy \
    --private-key "$DEPLOY_KEY" \
    --network "$NETWORK" \
    --endpoint "https://api.explorer.provable.com/v1" \
    --broadcast \
    --priority-fees "$FEE" \
    --yes

echo "Deployment complete!"

# Initialize if requested
if [ "$INIT" = true ]; then
    echo ""
    echo "Initializing contract..."
    # Derive admin address from private key
    ADMIN_ADDRESS=$(leo account import "$DEPLOY_KEY" 2>&1 | grep -oP 'aleo1\w+' | head -1)

    if [ -z "$ADMIN_ADDRESS" ]; then
        echo "Warning: Could not derive address from key. Provide ADMIN_ADDRESS in .env"
        ADMIN_ADDRESS="${ADMIN_ADDRESS:-}"
    fi

    if [ -n "$ADMIN_ADDRESS" ]; then
        echo "Setting admin to: $ADMIN_ADDRESS"
        leo execute initialize "$ADMIN_ADDRESS" \
            --private-key "$DEPLOY_KEY" \
            --network "$NETWORK" \
            --endpoint "https://api.explorer.provable.com/v1" \
            --broadcast \
            --yes

        echo "Contract initialized with admin: $ADMIN_ADDRESS"
    else
        echo "Error: No admin address available. Run initialize manually."
        exit 1
    fi
fi

echo "============================================"
echo "Done!"
echo "============================================"
