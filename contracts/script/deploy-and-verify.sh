#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────
# MUSASHI — Deploy & Verify on 0G Galileo Testnet
# ─────────────────────────────────────────────────────
# 0G ChainScan uses an Etherscan-compatible API at /open/api
# Only supports solidity-single-file (flattened), compilerversion without commit hash

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

# Load env
ENV_FILE="${CONTRACTS_DIR}/.env.local"
if [[ -f "$ENV_FILE" ]]; then
    set -a
    source "$ENV_FILE"
    set +a
fi

# ── Validation ──────────────────────────────────────
if [[ -z "${OG_CHAIN_PRIVATE_KEY:-}" ]]; then
    echo "ERROR: OG_CHAIN_PRIVATE_KEY not set in .env.local"
    exit 1
fi

RPC_URL="${OG_CHAIN_RPC:-https://evmrpc-testnet.0g.ai}"
VERIFIER_API="https://chainscan-galileo.0g.ai/open/api"
CHAIN_ID=16602
SOLC_VERSION="0.8.20"

echo "╔═══════════════════════════════════════════════╗"
echo "║   MUSASHI 武蔵 — Deploy & Verify              ║"
echo "║   Network: 0G Galileo Testnet (${CHAIN_ID})       ║"
echo "║   RPC: ${RPC_URL}"
echo "╚═══════════════════════════════════════════════╝"
echo ""

# ── Step 1: Deploy ──────────────────────────────────
echo ">>> Step 1: Deploying contracts..."
cd "$CONTRACTS_DIR"

forge script script/Deploy.s.sol \
    --rpc-url "$RPC_URL" \
    --broadcast \
    --legacy \
    -vvv || {
    echo "ERROR: Deployment failed"
    exit 1
}

# Extract deployed addresses from broadcast JSON
BROADCAST_FILE=$(find "$CONTRACTS_DIR/broadcast/Deploy.s.sol/$CHAIN_ID" -name "run-latest.json" 2>/dev/null | head -1)

if [[ -z "$BROADCAST_FILE" ]]; then
    echo "ERROR: Could not find broadcast file."
    exit 1
fi

# Parse addresses using python3 (available on macOS)
ADDRESSES=$(python3 -c "
import json
with open('$BROADCAST_FILE') as f:
    data = json.load(f)
creates = [tx['contractAddress'] for tx in data['transactions'] if tx['transactionType'] == 'CREATE']
print(creates[0])
print(creates[1])
")

CONVICTION_LOG=$(echo "$ADDRESSES" | head -1)
MUSASHI_INFT=$(echo "$ADDRESSES" | tail -1)

if [[ -z "$CONVICTION_LOG" || -z "$MUSASHI_INFT" ]]; then
    echo "ERROR: Could not parse deployed addresses"
    exit 1
fi

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  ConvictionLog:  $CONVICTION_LOG"
echo "│  MusashiINFT:    $MUSASHI_INFT"
echo "└─────────────────────────────────────────────┘"
echo ""

# ── Step 2: Flatten sources ─────────────────────────
echo ">>> Step 2: Flattening source files..."
FLAT_DIR=$(mktemp -d)
forge flatten src/ConvictionLog.sol > "$FLAT_DIR/ConvictionLog_flat.sol"
forge flatten src/MusashiINFT.sol > "$FLAT_DIR/MusashiINFT_flat.sol"
echo "  Flattened to $FLAT_DIR"

# ── Step 3: Wait for indexer ────────────────────────
echo ">>> Step 3: Waiting 15s for explorer to index..."
sleep 15

# ── Step 4: Verify ConvictionLog ────────────────────
echo ">>> Step 4: Verifying ConvictionLog..."

SOURCE_CODE=$(cat "$FLAT_DIR/ConvictionLog_flat.sol")
RESULT=$(curl -s -X POST "$VERIFIER_API" \
    -d "module=contract" \
    -d "action=verifysourcecode" \
    -d "contractaddress=$CONVICTION_LOG" \
    --data-urlencode "sourceCode=$SOURCE_CODE" \
    -d "codeformat=solidity-single-file" \
    -d "contractname=ConvictionLog" \
    -d "compilerversion=$SOLC_VERSION" \
    -d "optimizationUsed=0" \
    -d "runs=200" \
    -d "evmversion=shanghai" \
    -d "licenseType=3")

GUID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',''))")
STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))")

if [[ "$STATUS" == "1" && -n "$GUID" ]]; then
    echo "  Submitted (GUID: $GUID). Checking status..."
    sleep 8
    CHECK=$(curl -s "$VERIFIER_API?module=contract&action=checkverifystatus&guid=$GUID")
    CHECK_RESULT=$(echo "$CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',''))")
    echo "  ConvictionLog: $CHECK_RESULT"
else
    echo "  WARNING: Submission failed — $RESULT"
fi

echo ""

# ── Step 5: Verify MusashiINFT ──────────────────────
echo ">>> Step 5: Verifying MusashiINFT..."

# Constructor args: constructor(address _convictionLog)
CONSTRUCTOR_ARGS=$(cast abi-encode "constructor(address)" "$CONVICTION_LOG" | sed 's/^0x//')

SOURCE_CODE=$(cat "$FLAT_DIR/MusashiINFT_flat.sol")
RESULT=$(curl -s -X POST "$VERIFIER_API" \
    -d "module=contract" \
    -d "action=verifysourcecode" \
    -d "contractaddress=$MUSASHI_INFT" \
    --data-urlencode "sourceCode=$SOURCE_CODE" \
    -d "codeformat=solidity-single-file" \
    -d "contractname=MusashiINFT" \
    -d "compilerversion=$SOLC_VERSION" \
    -d "optimizationUsed=0" \
    -d "runs=200" \
    -d "evmversion=shanghai" \
    -d "constructorArguements=$CONSTRUCTOR_ARGS" \
    -d "licenseType=3")

GUID=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',''))")
STATUS=$(echo "$RESULT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))")

if [[ "$STATUS" == "1" && -n "$GUID" ]]; then
    echo "  Submitted (GUID: $GUID). Checking status..."
    sleep 8
    CHECK=$(curl -s "$VERIFIER_API?module=contract&action=checkverifystatus&guid=$GUID")
    CHECK_RESULT=$(echo "$CHECK" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',''))")
    echo "  MusashiINFT: $CHECK_RESULT"
else
    echo "  WARNING: Submission failed — $RESULT"
fi

# Cleanup
rm -rf "$FLAT_DIR"

echo ""

# ── Step 6: Update .env.local ───────────────────────
echo ">>> Step 6: Updating .env.local with deployed addresses..."

if grep -q "^CONVICTION_LOG_ADDRESS=" "$ENV_FILE"; then
    sed -i.bak "s|^CONVICTION_LOG_ADDRESS=.*|CONVICTION_LOG_ADDRESS=$CONVICTION_LOG|" "$ENV_FILE"
else
    echo "CONVICTION_LOG_ADDRESS=$CONVICTION_LOG" >> "$ENV_FILE"
fi

if grep -q "^MUSASHI_INFT_ADDRESS=" "$ENV_FILE"; then
    sed -i.bak "s|^MUSASHI_INFT_ADDRESS=.*|MUSASHI_INFT_ADDRESS=$MUSASHI_INFT|" "$ENV_FILE"
else
    echo "MUSASHI_INFT_ADDRESS=$MUSASHI_INFT" >> "$ENV_FILE"
fi

rm -f "${ENV_FILE}.bak"

echo ""
echo "╔═══════════════════════════════════════════════╗"
echo "║   DEPLOYMENT & VERIFICATION COMPLETE          ║"
echo "╠═══════════════════════════════════════════════╣"
echo "║  ConvictionLog:  $CONVICTION_LOG"
echo "║  MusashiINFT:    $MUSASHI_INFT"
echo "╠═══════════════════════════════════════════════╣"
echo "║  Explorer:                                    ║"
echo "║  https://chainscan-galileo.0g.ai/address/$CONVICTION_LOG"
echo "║  https://chainscan-galileo.0g.ai/address/$MUSASHI_INFT"
echo "╚═══════════════════════════════════════════════╝"
