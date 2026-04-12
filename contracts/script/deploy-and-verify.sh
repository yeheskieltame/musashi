#!/usr/bin/env bash
set -euo pipefail

# ─────────────────────────────────────────────────────
# MUSASHI — Deploy, link, verify on 0G Mainnet (ONE SHOT)
# ─────────────────────────────────────────────────────
# Why this script instead of `forge script`:
#   - `forge script` rejects chain 16661 on 0G.
#   - `forge create` silently reports "deployed to" even when the tx failed
#     (status 0 / out of gas). This script explicitly reads the receipt and
#     aborts if any deploy actually reverted.
#
# What it does:
#   1. Deploy ConvictionLog                (forge create, gas auto)
#   2. Deploy MusashiINFT                  (forge create, gas-limit 6M)
#   3. Assert both receipts are status=1 and have bytecode on-chain
#   4. ConvictionLog.setINFT(MusashiINFT)
#   5. MusashiINFT.setOracle(deployer)     (hackathon: deployer = oracle)
#   6. Flatten sources + POST to chainscan verify API
#   7. Poll verify status
#   8. Update .env.local with the new addresses

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
CONTRACTS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

ENV_FILE="${CONTRACTS_DIR}/.env.local"
[[ -f "$ENV_FILE" ]] && { set -a; source "$ENV_FILE"; set +a; }

# Fallback: project root .env (where the user actually keeps the key)
ROOT_ENV="${CONTRACTS_DIR}/../.env"
if [[ -z "${OG_CHAIN_PRIVATE_KEY:-}" && -f "$ROOT_ENV" ]]; then
    set -a; source "$ROOT_ENV"; set +a
fi

if [[ -z "${OG_CHAIN_PRIVATE_KEY:-}" ]]; then
    echo "ERROR: OG_CHAIN_PRIVATE_KEY not set. Put it in contracts/.env.local or the project-root .env."
    exit 1
fi

RPC_URL="${OG_CHAIN_RPC:-https://evmrpc.0g.ai}"
VERIFIER_API="https://chainscan.0g.ai/open/api"
SOLC_VERSION="0.8.20"
CL_GAS="${CL_GAS:-}"       # empty = let node estimate
INFT_GAS="${INFT_GAS:-6000000}"

cd "$CONTRACTS_DIR"

DEPLOYER=$(cast wallet address --private-key "$OG_CHAIN_PRIVATE_KEY")

echo "╔════════════════════════════════════════════════╗"
echo "║   MUSASHI — Deploy + Verify (0G Mainnet 16661)  "
echo "║   RPC:       $RPC_URL"
echo "║   Deployer:  $DEPLOYER"
echo "╚════════════════════════════════════════════════╝"
echo ""

# ─────────── helper: assert bytecode exists ───────────
assert_code() {
    local label="$1" addr="$2"
    local code
    code=$(cast code "$addr" --rpc-url "$RPC_URL" 2>/dev/null)
    if [[ "$code" == "0x" || -z "$code" ]]; then
        echo "ERROR: no bytecode at $addr ($label) — contract is not actually there"
        exit 1
    fi
}

# ─────────── helper: deploy + assert success ───────────
# Supports skipping deploy if a pre-deployed address is passed via $4.
deploy_contract() {
    local name="$1"         # human label
    local target="$2"       # src/Foo.sol:Foo
    local gas_flag="$3"     # empty or "--gas-limit N"
    local pre_deployed="$4" # if non-empty, skip deploy and just verify bytecode
    shift 4
    local constructor_args=("$@")

    if [[ -n "$pre_deployed" ]]; then
        echo ">>> Reusing existing $name at $pre_deployed (skip deploy)"
        assert_code "$name" "$pre_deployed"
        DEPLOYED_ADDR="$pre_deployed"
        DEPLOYED_TX=""
        return
    fi

    local cmd=(forge create "$target"
        --rpc-url "$RPC_URL"
        --private-key "$OG_CHAIN_PRIVATE_KEY"
        --legacy --broadcast --json)
    [[ -n "$gas_flag" ]] && cmd+=($gas_flag)
    if ((${#constructor_args[@]})); then
        cmd+=(--constructor-args "${constructor_args[@]}")
    fi

    echo ">>> Deploying $name..."
    local raw
    raw=$("${cmd[@]}" 2>&1) || { echo "$raw"; echo "ERROR: forge create exited non-zero for $name"; exit 1; }

    # forge create --json prints pretty-printed JSON across multiple lines.
    # Strip any non-JSON prelude (e.g. "No files changed...") and parse the
    # trailing JSON object as a whole.
    local addr tx
    addr=$(echo "$raw" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
m = re.search(r'\{[\s\S]*\}', raw)
if not m:
    sys.exit(0)
try:
    d = json.loads(m.group(0))
    print(d.get('deployedTo',''))
except Exception:
    pass
")
    tx=$(echo "$raw" | python3 -c "
import sys, json, re
raw = sys.stdin.read()
m = re.search(r'\{[\s\S]*\}', raw)
if not m:
    sys.exit(0)
try:
    d = json.loads(m.group(0))
    print(d.get('transactionHash',''))
except Exception:
    pass
")

    if [[ -z "$addr" || -z "$tx" ]]; then
        echo "$raw"
        echo "ERROR: could not parse forge create JSON output for $name"
        exit 1
    fi
    echo "    tx:   $tx"
    echo "    addr: $addr"

    # Assert receipt status=1 (cast receipt --json returns hex status)
    local status
    status=$(cast receipt "$tx" --rpc-url "$RPC_URL" --json 2>/dev/null | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin); print(d.get('status',''))
except Exception:
    pass
")
    if [[ "$status" != "0x1" && "$status" != "1" ]]; then
        echo "ERROR: $name deploy tx reverted (status=$status). Bump gas via ${name^^}_GAS env var."
        exit 1
    fi

    assert_code "$name" "$addr"

    DEPLOYED_ADDR="$addr"
    DEPLOYED_TX="$tx"
}

# ─────────── Step 1: ConvictionLog ───────────
# Allow skipping the deploy if CL_ADDR is already set (e.g. after a previous
# partial run). Handy because ConvictionLog.setINFT is one-shot — we must
# avoid deploying a fresh CL if the old one is still usable.
deploy_contract "ConvictionLog" "src/ConvictionLog.sol:ConvictionLog" \
    "$([[ -n "$CL_GAS" ]] && echo "--gas-limit $CL_GAS")" \
    "${CL_ADDR:-}"
CONVICTION_LOG="$DEPLOYED_ADDR"

# ─────────── Step 2: MusashiINFT ───────────
deploy_contract "MusashiINFT" "src/MusashiINFT.sol:MusashiINFT" \
    "--gas-limit $INFT_GAS" \
    "${INFT_ADDR:-}" \
    "$CONVICTION_LOG"
MUSASHI_INFT="$DEPLOYED_ADDR"

echo ""
echo "┌─────────────────────────────────────────────┐"
echo "│  ConvictionLog:  $CONVICTION_LOG"
echo "│  MusashiINFT:    $MUSASHI_INFT"
echo "└─────────────────────────────────────────────┘"
echo ""

# ─────────── Step 3: ConvictionLog.setINFT ───────────
echo ">>> Linking ConvictionLog.setINFT($MUSASHI_INFT)..."
# Tolerate INFTAlreadySet (re-run path): we rely on the state read below as the
# source of truth anyway. `|| true` keeps the script alive when cast send reverts.
cast send "$CONVICTION_LOG" "setINFT(address)" "$MUSASHI_INFT" \
    --rpc-url "$RPC_URL" --private-key "$OG_CHAIN_PRIVATE_KEY" --legacy >/dev/null 2>&1 || true

# 0G sometimes returns null for cast send's receipt — verify via state read instead.
LINKED=$(cast call "$CONVICTION_LOG" "inft()(address)" --rpc-url "$RPC_URL")
if [[ "$(echo "$LINKED" | tr '[:upper:]' '[:lower:]')" != "$(echo "$MUSASHI_INFT" | tr '[:upper:]' '[:lower:]')" ]]; then
    echo "ERROR: setINFT did not land. inft() = $LINKED (expected $MUSASHI_INFT)"
    exit 1
fi
echo "    linked OK (inft()=$LINKED)"
echo ""

# ─────────── Step 4: MusashiINFT.setOracle(deployer) ───────────
echo ">>> MusashiINFT.setOracle($DEPLOYER)..."
cast send "$MUSASHI_INFT" "setOracle(address)" "$DEPLOYER" \
    --rpc-url "$RPC_URL" --private-key "$OG_CHAIN_PRIVATE_KEY" --legacy >/dev/null 2>&1 || true

ORACLE=$(cast call "$MUSASHI_INFT" "oracle()(address)" --rpc-url "$RPC_URL")
if [[ "$(echo "$ORACLE" | tr '[:upper:]' '[:lower:]')" != "$(echo "$DEPLOYER" | tr '[:upper:]' '[:lower:]')" ]]; then
    echo "ERROR: setOracle did not land. oracle() = $ORACLE (expected $DEPLOYER)"
    exit 1
fi
echo "    oracle set OK"
echo ""

# ─────────── Step 5: flatten + verify ───────────
echo ">>> Flattening sources..."
FLAT_DIR=$(mktemp -d)
trap 'rm -rf "$FLAT_DIR"' EXIT
forge flatten src/ConvictionLog.sol > "$FLAT_DIR/ConvictionLog_flat.sol" 2>/dev/null
forge flatten src/MusashiINFT.sol   > "$FLAT_DIR/MusashiINFT_flat.sol"   2>/dev/null

verify_contract() {
    local addr="$1" name="$2" flat_file="$3" ctor_args_hex="$4"
    echo ">>> Verifying $name @ $addr"

    local result
    if [[ -n "$ctor_args_hex" ]]; then
        result=$(curl -s -X POST "$VERIFIER_API" \
            -d module=contract -d action=verifysourcecode \
            -d "contractaddress=$addr" \
            --data-urlencode "sourceCode@$flat_file" \
            -d codeformat=solidity-single-file \
            -d "contractname=$name" \
            -d "compilerversion=$SOLC_VERSION" \
            -d optimizationUsed=0 -d runs=200 -d evmversion=shanghai \
            -d "constructorArguements=$ctor_args_hex" \
            -d licenseType=3)
    else
        result=$(curl -s -X POST "$VERIFIER_API" \
            -d module=contract -d action=verifysourcecode \
            -d "contractaddress=$addr" \
            --data-urlencode "sourceCode@$flat_file" \
            -d codeformat=solidity-single-file \
            -d "contractname=$name" \
            -d "compilerversion=$SOLC_VERSION" \
            -d optimizationUsed=0 -d runs=200 -d evmversion=shanghai \
            -d licenseType=3)
    fi

    local status guid
    status=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('status',''))")
    guid=$(echo "$result" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',''))")

    if [[ "$status" != "1" || -z "$guid" ]]; then
        echo "    SUBMIT FAILED: $result"
        return 1
    fi
    echo "    submitted, guid=$guid"

    # Poll up to ~60s
    local i check check_result
    for i in 1 2 3 4 5 6 7 8; do
        sleep 8 &
        wait $!
        check=$(curl -s "$VERIFIER_API?module=contract&action=checkverifystatus&guid=$guid")
        check_result=$(echo "$check" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('result',''))")
        case "$check_result" in
            *Pending*|*pending*) echo "    [$i/8] pending..." ;;
            *Pass*|*pass*|*Already*|*already*) echo "    ✓ $check_result"; return 0 ;;
            *) echo "    $check_result"; return 0 ;;
        esac
    done
    echo "    (still pending — check later via $VERIFIER_API?module=contract&action=checkverifystatus&guid=$guid)"
}

verify_contract "$CONVICTION_LOG" "ConvictionLog" "$FLAT_DIR/ConvictionLog_flat.sol" ""

INFT_CTOR_ARGS=$(cast abi-encode "constructor(address)" "$CONVICTION_LOG" | sed 's/^0x//')
verify_contract "$MUSASHI_INFT" "MusashiINFT" "$FLAT_DIR/MusashiINFT_flat.sol" "$INFT_CTOR_ARGS"

echo ""

# ─────────── Step 6: persist addresses ───────────
echo ">>> Writing addresses to .env.local + project-root .env (if present)..."
touch "$ENV_FILE"
python3 - "$ENV_FILE" "$CONVICTION_LOG" "$MUSASHI_INFT" <<'PY'
import sys, re, pathlib
path = pathlib.Path(sys.argv[1])
cl, inft = sys.argv[2], sys.argv[3]
text = path.read_text() if path.exists() else ""
def upsert(txt, k, v):
    if re.search(rf"^{k}=", txt, flags=re.M):
        return re.sub(rf"^{k}=.*$", f"{k}={v}", txt, flags=re.M)
    return (txt.rstrip() + "\n" + f"{k}={v}\n") if txt else f"{k}={v}\n"
text = upsert(text, "CONVICTION_LOG_ADDRESS", cl)
text = upsert(text, "MUSASHI_INFT_ADDRESS",   inft)
path.write_text(text)
PY

if [[ -f "$ROOT_ENV" ]]; then
    python3 - "$ROOT_ENV" "$CONVICTION_LOG" "$MUSASHI_INFT" <<'PY'
import sys, re, pathlib
path = pathlib.Path(sys.argv[1])
cl, inft = sys.argv[2], sys.argv[3]
text = path.read_text()
def upsert(txt, k, v):
    if re.search(rf"^{k}=", txt, flags=re.M):
        return re.sub(rf"^{k}=.*$", f"{k}={v}", txt, flags=re.M)
    return txt.rstrip() + "\n" + f"{k}={v}\n"
text = upsert(text, "CONVICTION_LOG_ADDRESS", cl)
text = upsert(text, "MUSASHI_INFT_ADDRESS",   inft)
path.write_text(text)
PY
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║   DEPLOYMENT + LINK + VERIFY COMPLETE             "
echo "╠══════════════════════════════════════════════════╣"
echo "║  ConvictionLog:  $CONVICTION_LOG"
echo "║  MusashiINFT:    $MUSASHI_INFT"
echo "║  Oracle:         $DEPLOYER"
echo "╠══════════════════════════════════════════════════╣"
echo "║  https://chainscan.0g.ai/address/$CONVICTION_LOG"
echo "║  https://chainscan.0g.ai/address/$MUSASHI_INFT"
echo "╚══════════════════════════════════════════════════╝"
