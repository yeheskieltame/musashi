# MUSASHI

**The First On-Chain Reputation Protocol for AI Agents -- Built on 0G**

_"A thousand tokens watched. One conviction taken. Every call on-chain."_

MUSASHI is two things:

1. **A token analysis skill** -- an OpenClaw Skill AND Claude Code slash commands that run tokens through 7 elimination gates, 4 specialist analyses, cross-domain pattern detection, and adversarial debate. 97% of tokens get eliminated.

2. **A reputation protocol** -- any AI agent can mint an INFT identity, submit conviction signals (STRIKEs) to 0G Chain, store verifiable evidence on 0G Storage, and build an on-chain track record. No self-reported stats. No trust-me-bro. Every call, every outcome, every win and loss -- on-chain and verifiable.

### Why This Matters

ERC-7857 gives AI agents **identity** (INFT). But identity without reputation is meaningless. If there are 100 agents on a marketplace, which one do you trust? The one with a **verifiable track record**: 50 strikes, 35 wins, +4200 bps cumulative return -- all on-chain, all backed by downloadable evidence with merkle proofs.

MUSASHI builds the missing **reputation layer** for 0G's agent ecosystem.

---

## Deployed Contracts (0G Mainnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| ConvictionLog | `0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed` | [View](https://chainscan.0g.ai/address/0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed) |
| MusashiINFT | `0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32` | [View](https://chainscan.0g.ai/address/0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32) |

Network: 0G-Mainnet, Chain ID: 16661

### Supported Chains (Token Analysis)

| Chain | ID | RPC |
|-------|-----|-----|
| Ethereum | 1 | eth.llamarpc.com |
| BSC | 56 | bsc-dataseed.binance.org |
| Polygon | 137 | polygon-rpc.com |
| Arbitrum | 42161 | arb1.arbitrum.io/rpc |
| Base | 8453 | mainnet.base.org |
| 0G | 16661 | evmrpc.0g.ai |

---

## Problem

Narrative-driven crypto traders face four problems:

| Problem | Description |
|---------|-------------|
| Signal overload | Hundreds of new tokens daily. No human cross-references contract safety, wallet behavior, social momentum, and market timing simultaneously. |
| Confirmation bias | Find one bullish signal, stop looking. Existing tools generate signals, not eliminate them. |
| No framework | Stock traders have P/E ratios. Meme traders have vibes and Telegram alpha calls. |
| The specialist problem | Social mentions +400% looks bullish. But 80% of buyers are fresh wallets. No single analyst catches this -- the pattern is invisible until someone overlays both perspectives. |

---

## Architecture

### Two Layers: Analysis Engine + Reputation Protocol

```
                         ANALYSIS ENGINE (OpenClaw Skill / Claude Code)
                         ================================
                         Any agent can implement their own pipeline.
                         MUSASHI's pipeline: 7 gates → 4 specialists →
                         pattern detection → adversarial debate → judge
                                          │
                                     PASS │ FAIL → stop, no 0G cost
                                          │
                         REPUTATION PROTOCOL (0G Infrastructure)
                         =======================================
                                          │
                    ┌─────────────────────┼──────────────────────┐
                    │                     │                      │
              0G Storage            0G Chain                0G Chain
              Evidence Archive      ConvictionLog           MusashiINFT
              ──────────────        ──────────────          ────────────
              Full analysis JSON    Strike records          Agent identity
              Merkle root hash      Per-agent reputation    Win rate on-chain
              Download + verify     Global reputation       Clone / authorize
                    │                     │                      │
                    └─────────────────────┼──────────────────────┘
                                          │
                              VERIFICATION (anyone)
                              ========================
                              1. Read strike from ConvictionLog
                              2. See agentId → check INFT identity + reputation
                              3. Download evidence from 0G Storage
                              4. Verify merkle proof → data untampered
                              5. Judge the reasoning yourself
```

### Multi-Agent Protocol

ConvictionLog is **not single-tenant**. Any agent with an INFT can participate:

```
Agent #0 "MUSASHI"  → logs strikes → per-agent reputation: 7W/3L, +2500 bps
Agent #1 "ALPHA-X"  → logs strikes → per-agent reputation: 3W/5L, -1200 bps
Agent #2 "DEGEN-AI" → logs strikes → per-agent reputation: 12W/2L, +8000 bps
                                      ↑
                          Each agent's track record is independent,
                          verifiable, and backed by evidence on 0G Storage.
```

Anyone can build their own analysis pipeline (different gates, different strategies) and plug into the same reputation protocol. The `logStrike` function verifies the caller owns the specified INFT -- no one can fake another agent's track record.

### Component Overview

| Layer | Component | Role |
|-------|-----------|------|
| Skill | SKILL.md + .claude/commands/ | Teaches agents HOW to investigate tokens (OpenClaw + Claude Code) |
| Engine | musashi-core (Go) | High-performance data engine. Gates 1-3, 6-7. Publishes STRIKEs. |
| Memory | musashi-core history | On-chain learning: reads past strikes + outcomes, feeds into judge |
| Agent | OpenClaw or Claude Code | Gates 4-5 (social investigation), specialists, debate, judge |
| Protocol | ConvictionLog.sol | Multi-agent STRIKE log. Per-agent + global reputation. |
| Identity | MusashiINFT.sol | ERC-7857 agent INFT. Identity + reputation + intelligence on-chain. |
| Evidence | 0G Storage | Decentralized evidence archive. Merkle proofs for verification. |

---

## Gate Pipeline

Sequential elimination with **age-tiered thresholds**. Token age is auto-detected from DexScreener's `pairCreatedAt`. Fresh tokens (<24h) get lower thresholds because they're naturally early-stage — but contract safety remains strict regardless of age.

| Gate | Name | Source | Fail Conditions | Age-Tiered? |
|------|------|--------|-----------------|-------------|
| 1 | Contract Safety | GoPlus API | Honeypot, mintable, ownership takeback, blacklist, pausable transfers, modifiable slippage, sell tax >5%, asymmetric tax, unaudited proxy | **No** — always strict |
| 2 | Liquidity Structure | DexScreener, GoPlus | No DEX pairs, liquidity below minimum, LP depth too thin, no locked LP, volume below minimum | **Yes** — see tiers below |
| 3 | Wallet Behavior | DexScreener, GoPlus | Too few holders, no transactions, heavy sell pressure, low activity, active dump | **Yes** — see tiers below |
| 4 | Social Momentum | Agent browsing | Agent browses X/Twitter, Farcaster. Assesses organic vs bot, velocity, quality. Low social on fresh tokens is NOT a failure. | Agent-driven |
| 5 | Narrative Alignment | Agent browsing | Agent researches narrative meta, lifecycle stage (Forming/Growing/Peak/Declining), competition, catalysts. Forming narrative = strong pass. | Agent-driven |
| 6 | Market Timing | CoinGecko, DefiLlama | Market cap 24h drop >8%, chain TVL decline >15% (7d) or >30% (30d) | No |
| 7 | Cross-Validation | DexScreener, GeckoTerminal | Both sources fail, price divergence >10%, volume divergence >50% | No |

### Age-Tiered Thresholds (Gates 2 & 3)

| Metric | Fresh (<24h) | Early (1-7d) | Established (>7d) |
|--------|-------------|-------------|-------------------|
| Min liquidity | $5,000 | $8,000 | $10,000 |
| Min 24h volume | $500 | $800 | $1,000 |
| Min LP/mcap ratio | 3% | 4% | 5% |
| Min holders | 15 | 30 | 50 |
| Min 24h txns | 5 | 10 | 20 |
| Max sell ratio | 80% | 75% | 70% |
| LP not locked | WARN | FAIL | FAIL |

### Trend Analysis (Gate 3)

Beyond snapshots, Gate 3 now analyzes **trends**:
- **Activity acceleration**: is trading activity increasing or decreasing? (`1h * 24 vs 24h`)
- **Buy/sell pressure trend**: comparing sell ratios across 6h and 24h timeframes
- **Buy concentration warning**: >90% buys with 50+ txns flags potential wash trading

Gates 1-3, 6-7 run via the Go binary. Gates 4-5 run via the agent's investigation tools (OpenClaw `browser` or Claude Code `WebSearch`/`WebFetch`).

---

## Specialist Analysis and Debate

After gates pass, 4 specialists analyze independently (each sees only its domain):

| Specialist | Domain | Input |
|------------|--------|-------|
| Safety Specialist | Contract + liquidity risk | Gate 1+2 data |
| On-Chain Specialist | Wallet distribution + behavior | Gate 3 data |
| Narrative Specialist | Social + narrative positioning | Agent-driven browsing |
| Market Specialist | Macro timing + data consistency | Gate 6+7 data |

Then:

1. **Musashi Pattern Detection** -- sees all 4 reports simultaneously. Finds contradictions, hidden correlations, convergence score (1-4), single points of failure, temporal misalignment.
2. **Adversarial Debate** -- Bull and Bear researchers argue with live evidence from web search. 2 rounds.
3. **Conviction Judge** -- PASS or FAIL. Hesitation = FAIL.

If PASS: evidence stored to 0G Storage, STRIKE published to ConvictionLog on 0G Chain.

---

## Agent Memory: On-Chain Learning

MUSASHI doesn't just analyze — it **learns from its own track record**. This is what separates a true agent from an automation script.

### The Learning Loop

```
Analyze token → PASS → Publish STRIKE on-chain → Time passes → Record outcome
       ↑                                                              ↓
       └──── history command reads back ←── reputation updates on-chain
```

### How It Works

1. **On-Chain Track Record** — Every STRIKE and its outcome is recorded permanently on ConvictionLog. The `history` command reads the last N strikes with outcomes and reputation stats.

2. **Judge Self-Calibration** — Before making a PASS/FAIL decision, the Conviction Judge receives the agent's on-chain track record: win rate, cumulative return, recent strike outcomes. It calibrates its conviction threshold accordingly:
   - Win rate >70%: threshold well-calibrated, maintain standards
   - Win rate 50-70%: tighten standards, require stronger convergence
   - Win rate <50%: agent has been too permissive, apply maximum hesitation

3. **Historical Pattern Matching** — The Musashi Pattern Detector cross-references the current token's gate signature against past strikes. "This pattern resembles Strike #3 which returned +5.0%" or "Similar to Strike #4 which returned -8.0% — the narrative had peaked."

4. **Verifiable Performance** — All of this is on-chain. Anyone can query `agentReputation(0)` and verify the agent's track record. No self-reported stats. No trust-me-bro.

### Example: Agent Memory in Action

```bash
# Query agent's on-chain memory
./scripts/musashi-core/musashi-core history --agent-id 0 --limit 12

# Output includes:
# - 12 strikes with outcomes (wins/losses/pending)
# - Agent reputation: 66.7% win rate, +52.5% cumulative return
# - This data is injected into the judge's context before every decision
```

The judge might reason: *"My track record shows 4 wins and 2 losses with a 66.7% win rate. My losses came from tokens where the narrative had already peaked. This current token shows a forming narrative with strong on-chain accumulation — similar to Strike #3 which returned +5.0%. Maintaining current conviction threshold."*

---

## 0G Integration (3 Components, Deep)

### 0G Chain -- ConvictionLog (Reputation Protocol)

**The core protocol.** Any INFT-holding agent can log conviction STRIKEs. Each strike records: which agent (`agentId`), which token, which chain, convergence score, and evidence hash (link to 0G Storage).

- **Per-agent reputation** -- `agentReputation(agentId)` returns strikes, filled, wins, losses, cumulative return for a specific agent
- **Global reputation** -- `reputation()` returns aggregate stats across all agents
- **Outcome recording** -- contract owner records outcomes (objective facts: token went up/down X%)
- **Access control** -- `logStrike` verifies caller owns the INFT via cross-contract call to MusashiINFT. No one can fake another agent's track record
- **Storage** -- packed structs (4 slots per strike), O(1) reputation updates, Ownable2Step + Pausable

### 0G Chain -- MusashiINFT (Agent Identity, ERC-7857)

Each agent is tokenized as an Intelligent NFT with on-chain reputation:

- **Identity** -- name, owner, config hash, intelligence hash
- **Reputation** -- win rate and total strikes synced from ConvictionLog per-agent data
- **Clone** -- replicate agent with same intelligence (fresh reputation)
- **Authorize** -- grant time-limited execution access to other addresses
- **Transfer** -- agent ownership is transferable (with reputation intact)
- **Cross-contract link** -- ConvictionLog is immutable reference, setINFT one-time setter resolves circular dependency

### 0G Storage -- Verifiable Evidence Archive

Full pipeline evidence (gate results, specialist reports, debate transcripts) uploaded as JSON via `0g-storage-client` CLI. Merkle root hash stored on-chain as `evidenceHash`.

**Verification flow:**
```bash
# Anyone can download evidence and verify it hasn't been tampered with:
0g-storage-client download --indexer <indexer> --root <hash_from_strike> --file evidence.json --proof
```

This creates a complete audit trail: **agent identity (INFT) → conviction signal (ConvictionLog) → full analysis (0G Storage) → merkle proof (untampered)**.

### How the Three Components Connect

```
1. Agent mints INFT        → MusashiINFT.mint("AGENT-NAME", configHash, intelHash)
2. Agent analyzes token     → pipeline runs (gates, specialists, debate)
3. Evidence uploaded        → 0G Storage → returns merkle root hash
4. STRIKE published         → ConvictionLog.logStrike(agentId, token, chain, convergence, evidenceHash)
5. Outcome recorded later   → ConvictionLog.recordOutcome(strikeId, returnBps)
6. Reputation synced        → MusashiINFT.updateIntelligence(tokenId, newHash) → reads per-agent reputation
7. Anyone verifies          → read ConvictionLog → check INFT → download evidence → verify merkle proof
```

---

## Data Sources (All Free, No API Keys Required)

| Source | Data | Used By |
|--------|------|---------|
| GoPlus Security | Honeypot, mint, tax, proxy, blacklist, LP holders | Gate 1, 2, 3 |
| DexScreener | Prices, pairs, volume, liquidity, buy/sell txns | Gate 2, 3, 7 |
| GeckoTerminal | Token data, pools, OHLCV, new/trending pools | Gate 7, Discovery |
| CoinGecko | Global market data, BTC dominance, trending | Gate 6 |
| DefiLlama | Chain TVL history, stablecoin flows | Gate 6 |
| Farcaster/Neynar | Casts, mentions, social signals | Agent social analysis (Neynar requires a free API key) |
| Public RPCs | On-chain reads (balance, code, ERC20 calls) | Gate support |

Social analysis (X/Twitter, Telegram) is done via the agent's investigation tools (OpenClaw's `browser` or Claude Code's `WebSearch`/`WebFetch`) -- no paid API subscriptions. Neynar's Farcaster API requires a free key from [neynar.com](https://neynar.com) but is optional.

---

## Setup

### Prerequisites

- Go 1.26+ (see `go.mod` for exact version)
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- `0g-storage-client` CLI
- `make` (included on macOS; on Linux install via `sudo apt install build-essential`)

### Install 0g-storage-client

```bash
git clone --depth 1 https://github.com/0glabs/0g-storage-client.git /tmp/0g-storage-client
cd /tmp/0g-storage-client && go build -o 0g-storage-client .
sudo cp 0g-storage-client /usr/local/bin/
```

### Clone and Build

```bash
git clone https://github.com/yeheskieltame/musashi.git
cd musashi
```

Build the Go binary:

```bash
make core
```

Build contracts (optional, already deployed):

```bash
make contracts
```

Run all tests:

```bash
make test
```

### Configure Environment

```bash
cp .env.example .env
```

Edit `.env`:

```
OG_CHAIN_RPC=https://evmrpc.0g.ai
CONVICTION_LOG_ADDRESS=0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed
MUSASHI_INFT_ADDRESS=0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32

# Optional: only needed for on-chain publishing (strike, store, mint, update)
# Use a dedicated wallet with minimal funds — never your main wallet
OG_CHAIN_PRIVATE_KEY=your_dedicated_wallet_key_here
OG_STORAGE_RPC=https://evmrpc.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
```

Mainnet requires real 0G (A0GI) tokens for gas. Acquire A0GI via [0G's official channels](https://0g.ai).

### Load Environment

All commands below assume environment is loaded:

```bash
set -a && source .env && set +a
```

> **For deployment only**: use Foundry keystore instead of env var (more secure):
> ```bash
> cast wallet import musashi-deployer --interactive
> # Then use: make deploy-conviction ACCOUNT=musashi-deployer
> ```

---

## CLI Reference

### musashi-core commands

> **Note:** The binary is at `scripts/musashi-core/musashi-core`. Run commands from the project root using `./scripts/musashi-core/musashi-core`, or use `make` targets for convenience.

| Command | Description | Example |
|---------|-------------|---------|
| `scan` | **Find best opportunities** — fetch, score, rank tokens automatically | `./scripts/musashi-core/musashi-core scan --chain 8453 --limit 10 --gates` |
| `gates` | Run elimination gates on a specific token | `./scripts/musashi-core/musashi-core gates 0x2260FA...99 --chain 1 --output json` |
| `search` | Search token by name/ticker | `./scripts/musashi-core/musashi-core search "PEPE" --limit 5` |
| `discover` | Raw token discovery (new/trending pools) | `./scripts/musashi-core/musashi-core discover --chain 1 --limit 20` |
| `strike` | Publish STRIKE to ConvictionLog | `./scripts/musashi-core/musashi-core strike 0x2260FA...99 --agent-id 0 --convergence 4 --evidence <hash>` |
| `store` | Upload evidence JSON to 0G Storage | `./scripts/musashi-core/musashi-core store '{"token":"0x...","analysis":"..."}' ` |
| `status` | Query global or per-agent reputation | `./scripts/musashi-core/musashi-core status` or `... status --per-agent --agent-id 0` |
| `record-outcome` | Record STRIKE outcome | `./scripts/musashi-core/musashi-core record-outcome --strike-id 0 --return-bps 500` |
| `set-inft` | Link MusashiINFT to ConvictionLog (one-time) | `./scripts/musashi-core/musashi-core set-inft 0xFB1C...488` |
| `mint-agent` | Mint agent INFT | `./scripts/musashi-core/musashi-core mint-agent --name MUSASHI --config-hash <hash> --intelligence-hash <hash>` |
| `update-agent` | Update agent intelligence + sync reputation | `./scripts/musashi-core/musashi-core update-agent --token-id 0 --intelligence-hash <hash>` |
| `history` | Query strike history + reputation (agent memory) | `./scripts/musashi-core/musashi-core history --agent-id 0 --limit 12` |
| `agent-info` | Query INFT agent state | `./scripts/musashi-core/musashi-core agent-info --token-id 0` |

### Full flag reference

```
musashi-core scan
  --chain int64        Filter by chain ID (0=all, 1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G) (default 0)
  --limit int          Max tokens to return (default 10)
  --gates              Auto-run gate pipeline on top 5 candidates

musashi-core gates [token_address]
  --chain int64        Chain ID: 1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G (default 1)
  --output string      Output format: json or pretty (default "json")

musashi-core search [query]
  --limit int          Max results (default 5)

musashi-core strike [token_address]
  --agent-id uint64    INFT agent token ID (default 0)
  --convergence uint8  Convergence score, 3 or 4 (default 3)
  --evidence string    Evidence hash from 0G Storage
  --token-chain int64  Chain ID where the token lives (default 1)

musashi-core store [evidence_json]
  (no flags, takes JSON string as argument)

musashi-core discover
  --chain int64        Chain ID (default 1)
  --limit int          Max tokens to return (default 20)

musashi-core status
  --per-agent          Show per-agent reputation instead of global
  --agent-id uint64    INFT agent ID (used with --per-agent)

musashi-core set-inft [inft_address]
  (one-time setup, links MusashiINFT to ConvictionLog)

musashi-core record-outcome
  --strike-id uint64   Strike ID to record outcome for (default 0)
  --return-bps int64   Return in basis points, positive=win, negative=loss (default 0)

musashi-core mint-agent
  --name string              Agent name (default "MUSASHI")
  --config-hash string       Config hash from 0G Storage
  --intelligence-hash string Intelligence/prompts hash from 0G Storage

musashi-core update-agent
  --token-id uint64          INFT token ID (default 0)
  --intelligence-hash string New intelligence hash

musashi-core history
  --agent-id uint64    INFT agent token ID (default 0)
  --limit int          Max strikes to fetch (default 20)

musashi-core agent-info
  --token-id uint64          INFT token ID to query (default 0)
```

### Makefile targets

```bash
make core              # Build musashi-core binary
make contracts         # Build Solidity contracts
make test              # Run all tests (Go + Foundry)
make test-core         # Run Go tests only
make test-contracts    # Run Foundry tests only
make deploy            # Show deployment instructions
make deploy-conviction ACCOUNT=musashi-deployer    # Deploy ConvictionLog
make deploy-inft CONVICTION_LOG=0x... ACCOUNT=...  # Deploy MusashiINFT
make deploy-link CONVICTION_LOG=0x... INFT=0x... ACCOUNT=...  # Link contracts
make gates TOKEN=0x... CHAIN=1        # Run gates on a token
make scan CHAIN=8453 LIMIT=10        # Scan and rank best opportunities
make discover CHAIN=1 LIMIT=20       # Raw token discovery
make status                           # Query ConvictionLog state
make agent-info TOKEN_ID=0            # Query INFT agent state
make mint-agent CONFIG_HASH=... INTEL_HASH=...  # Mint INFT
make store-evidence EVIDENCE='{"key":"value"}'  # Store to 0G Storage
make record-outcome STRIKE_ID=0 RETURN_BPS=500  # Record outcome
make clean             # Remove build artifacts
make all               # Build everything
```

### Full pipeline example

```bash
# Load environment first
set -a && source .env && set +a

# 1. Run gates
./scripts/musashi-core/musashi-core gates 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 --chain 1 --output json > evidence.json

# 2. Store evidence to 0G Storage
./scripts/musashi-core/musashi-core store "$(cat evidence.json)"
# Returns: { "root_hash": "0xabc...", "storage_scan": "https://storagescan.0g.ai/file/0xabc..." }

# 3. Publish STRIKE with evidence hash and agent ID
./scripts/musashi-core/musashi-core strike 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 \
  --agent-id 0 \
  --convergence 4 \
  --evidence abc123...  \
  --token-chain 1
# Returns: { "tx_hash": "0x...", "explorer_url": "https://chainscan.0g.ai/tx/0x..." }

# 4. Check per-agent reputation
./scripts/musashi-core/musashi-core status --per-agent --agent-id 0
# Returns: { "agent_id": 0, "strikes": 1, "wins": 0, "losses": 0, ... }

# 5. Check global reputation (all agents)
./scripts/musashi-core/musashi-core status
# Returns: { "strike_count": 1, "wins": 0, "losses": 0, ... }

# 6. Record outcome later (owner only — outcomes are objective facts)
./scripts/musashi-core/musashi-core record-outcome --strike-id 0 --return-bps 1200

# 7. Query agent memory (history + reputation for learning)
./scripts/musashi-core/musashi-core history --agent-id 0 --limit 12
# Returns: strikes with outcomes + reputation stats — fed into judge for self-calibration

# 8. Sync reputation to INFT
./scripts/musashi-core/musashi-core update-agent --token-id 0 --intelligence-hash <new_hash>
```

### OpenClaw Skill Usage

#### Install from ClawHub

```bash
openclaw skills install musashi
```

The Go binary (`musashi-core`) is built automatically from source during install (requires Go 1.26+).

#### Configure Environment

MUSASHI has two modes. **Analysis mode works without any private key.**

**Minimal config (analysis only)** -- add to your `openclaw.json`:

```json
{
  "skills": {
    "entries": {
      "musashi": {
        "env": {
          "OG_CHAIN_RPC": "https://evmrpc.0g.ai",
          "CONVICTION_LOG_ADDRESS": "0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed",
          "MUSASHI_INFT_ADDRESS": "0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32"
        }
      }
    }
  }
}
```

This gives you the full pipeline: 7 gates, 4 specialists, pattern detection, adversarial debate, and conviction judge. No wallet needed.

**Full config (analysis + on-chain publishing)** -- add the private key for STRIKE publishing:

```json
{
  "skills": {
    "entries": {
      "musashi": {
        "env": {
          "OG_CHAIN_RPC": "https://evmrpc.0g.ai",
          "CONVICTION_LOG_ADDRESS": "0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed",
          "MUSASHI_INFT_ADDRESS": "0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32",
          "OG_CHAIN_PRIVATE_KEY": "your-dedicated-wallet-key",
          "OG_STORAGE_RPC": "https://evmrpc.0g.ai",
          "OG_STORAGE_INDEXER": "https://indexer-storage-turbo.0g.ai"
        }
      }
    }
  }
}
```

> **Security:** Use a dedicated wallet with minimal funds -- never your main wallet. MUSASHI always asks for explicit confirmation before signing any transaction. The skill has `disable-model-invocation: true`, meaning it only runs when you explicitly request it.

For enhanced key security, use a secret manager via SecretRef:

```json
"OG_CHAIN_PRIVATE_KEY": { "source": "exec", "id": "op read op://vault/musashi-key/credential" }
```

#### Optional: Install 0g-storage-client

Only needed if you want evidence uploaded to 0G Storage (publish mode):

```bash
git clone --depth 1 https://github.com/0glabs/0g-storage-client.git /tmp/0g-storage-client
cd /tmp/0g-storage-client && go build -o 0g-storage-client .
sudo cp 0g-storage-client /usr/local/bin/
```

#### Use It

Invoke with `/musashi` or message your agent:

```
"Scan Base chain for the best opportunities"
"Find me early tokens with clean fundamentals"
"Analyze token 0x1234 on Base"
"What's the current narrative meta?"
"Show my STRIKE history"
```

The agent will run the full pipeline and report results. If a token passes all gates and the conviction judge says PASS, it will ask you before publishing on-chain.

#### Claude Code Usage

MUSASHI also runs natively in [Claude Code](https://claude.ai/claude-code) via custom slash commands.

**Setup:**

```bash
git clone https://github.com/yeheskieltame/musashi.git
cd musashi
make core                          # Build the Go binary
set -a && source .env && set +a   # Load environment
```

**Available Slash Commands:**

| Command | Description |
|---------|-------------|
| `/analyze <token>` | Full 8-step pipeline: gates → specialists → debate → judge |
| `/scan [chain] [--gates]` | Scan, score, and rank token opportunities |
| `/gates <token>` | Run 5 automated gates (1,2,3,6,7) via Go binary |
| `/strike <token> <args>` | Publish STRIKE conviction to 0G Chain |
| `/status` | Check on-chain reputation and agent state |
| `/discover [chain]` | Raw token discovery with pre-screening |

**Examples in Claude Code:**

```
/analyze 0x1234...abcd on Base
/scan base --gates
/gates PEPE
/status
/discover eth
```

Claude Code uses `Bash` to run musashi-core (instead of OpenClaw's `exec`) and `WebSearch`/`WebFetch` for social investigation (instead of OpenClaw's `browser`). The analysis pipeline, prompts, and Go binary are identical -- only the agent runtime differs.

---

## Frontend Dashboard

MUSASHI includes a Next.js web dashboard that connects directly to the deployed contracts on 0G Mainnet.

### Features

| Component | Description |
|-----------|-------------|
| Token Scanner | Search and scan tokens across 6 chains (ETH, BSC, Polygon, Arbitrum, Base, 0G) |
| Gate Pipeline | Visual gate results with pass/fail per gate |
| Strike Ledger | Browse all published STRIKEs from ConvictionLog |
| Strike Publisher | Publish STRIKEs directly from the browser (wallet required) |
| Reputation Panel | View per-agent and global reputation stats |
| Agent Chat | Interactive agent interface for analysis |
| Wallet Connect | MetaMask / injected wallet connection to 0G Mainnet |

### Run Locally

```bash
cd frontend
pnpm install
pnpm dev
# Open http://localhost:3000
```

The dashboard reads from the same mainnet contracts:
- ConvictionLog: `0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed`
- MusashiINFT: `0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32`

---

## Project Structure

```
musashi/
├── SKILL.md                         OpenClaw skill definition
├── .claude/commands/                Claude Code slash commands
│   ├── analyze.md                   Full pipeline (/analyze)
│   ├── scan.md                      Token scanner (/scan)
│   ├── gates.md                     Gate check (/gates)
│   ├── strike.md                    Publish STRIKE (/strike)
│   ├── status.md                    On-chain status (/status)
│   └── discover.md                  Token discovery (/discover)
├── frontend/                        Next.js dashboard (0G Mainnet)
│   ├── src/app/                     Landing page + interactive dashboard
│   ├── src/components/              TokenScanner, StrikeLedger, StrikePublisher,
│   │                                AgentChat, ReputationPanel, GatePipeline,
│   │                                CommandBar, WalletConnect
│   ├── src/lib/contracts.ts         On-chain ABIs + mainnet contract addresses
│   └── src/lib/wagmi.ts             0G Mainnet chain definition (ID: 16661)
├── scripts/
│   ├── musashi-core/                Go binary source
│   │   ├── cmd/musashi/main.go      CLI entry point (13 commands)
│   │   └── internal/
│   │       ├── data/                API clients: goplus, dexscreener, geckoterminal,
│   │       │                        coingecko, defillama, farcaster, rpc
│   │       ├── gates/               Gate implementations (age-tiered thresholds,
│   │       │                        trend analysis): contract_safety, liquidity,
│   │       │                        wallets, timing, cross_validation
│   │       ├── pipeline/            Gate runner, token discovery, scanner (rank+score)
│   │       ├── storage/             0G Storage client (wraps 0g-storage-client CLI)
│   │       └── chain/               0G Chain interaction: conviction.go, inft.go
│   ├── gate_check.sh                Shell wrapper for gate checks
│   └── publish_strike.sh            Shell wrapper for strike publishing
├── prompts/                         Agent system prompts (8 files)
│   ├── safety_specialist.md         Safety domain (Gate 1+2 data)
│   ├── onchain_specialist.md        On-chain domain (Gate 3 data)
│   ├── narrative_specialist.md      Narrative domain (agent browsing)
│   ├── market_specialist.md         Market domain (Gate 6+7 data)
│   ├── musashi_pattern.md           Cross-domain pattern detector
│   ├── bull_researcher.md           Adversarial bull case
│   ├── bear_researcher.md           Adversarial bear case
│   └── conviction_judge.md          Binary PASS/FAIL judge
├── contracts/                       Solidity (Foundry, Solc 0.8.20)
│   ├── src/ConvictionLog.sol        Multi-agent reputation protocol (per-agent + global)
│   ├── src/MusashiINFT.sol          Agent INFT (ERC-7857, linked to ConvictionLog)
│   ├── test/ConvictionLog.t.sol     20 tests (multi-agent, per-agent reputation)
│   ├── test/MusashiINFT.t.sol       22 tests (INFT, per-agent sync, ownerOf)
│   └── script/Deploy.s.sol          Foundry deployment script
├── references/
│   ├── GATES.md                     Detailed gate criteria and thresholds
│   ├── PATTERNS.md                  Pattern detection examples
│   └── API_ENDPOINTS.md             All free API endpoints with examples
├── CLAUDE.md                        Development context
├── Makefile                         Build, test, deploy, run targets
└── .env.example                     Environment template
```

---

## Environment Variables

### Analysis Mode (read-only, no private key)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `OG_CHAIN_RPC` | Yes | 0G Chain RPC endpoint | `https://evmrpc.0g.ai` |
| `CONVICTION_LOG_ADDRESS` | Yes | ConvictionLog contract address | — |
| `MUSASHI_INFT_ADDRESS` | Yes | MusashiINFT contract address | — |

### Publish Mode (on-chain signing)

| Variable | Required | Description | Default |
|----------|----------|-------------|---------|
| `OG_CHAIN_PRIVATE_KEY` | For publishing only | Dedicated wallet key (hex, with or without 0x prefix) | — |
| `OG_STORAGE_RPC` | For evidence upload | 0G Storage RPC | `https://evmrpc.0g.ai` |
| `OG_STORAGE_INDEXER` | For evidence upload | 0G Storage indexer | `https://indexer-storage-turbo.0g.ai` |

> Without `OG_CHAIN_PRIVATE_KEY`, all analysis commands work normally. Only `strike`, `store`, `mint-agent`, `update-agent`, and `set-inft` require a key. These commands return a graceful `analysis_only` / `skipped` status instead of erroring when no key is set.

---

## Hackathon

**0G APAC Hackathon 2026** -- Track 1: Agentic Infrastructure & OpenClaw Lab

| Property | Value |
|----------|-------|
| Prize Pool | $150,000 USD |
| Organizer | 0G Labs x HackQuest |
| Deadline | 9 May 2026, 23:59 UTC+8 |
| Builder | Yeheskiel Yunus Tame ([@YeheskielTame](https://x.com/YeheskielTame)) |
| University | Universitas Kristen Duta Wacana, Yogyakarta |
| Prior Work | Tessera -- Juara 1, Synthesis Hackathon (March 2026) |

### Submission Checklist

- [x] GitHub repo with substantial development
- [x] 0G mainnet contract addresses + Explorer links with verifiable activity
- [x] 0G Storage integration with evidence uploads
- [x] INFT (ERC-7857) agent tokenization
- [x] README with architecture + 0G integration explanation + setup guide
- [x] Next.js frontend dashboard with wallet connect + on-chain reads/writes
- [ ] Demo video (3 minutes max)
- [ ] Public X post with #0GHackathon #BuildOn0G

### Inspiration

| Source | What MUSASHI Takes |
|--------|-------------------|
| [Tessera](https://github.com/yeheskieltame/Tessera) | Gate elimination, Go binary, evidence pipeline |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | Specialist roles, adversarial debate |
| [OpenClaw](https://github.com/openclaw/openclaw) | Skill system, agent tools, distribution |

---

## 30-Word Description

> MUSASHI is an on-chain reputation protocol on 0G where AI agents analyze tokens through 7 elimination gates, publish conviction STRIKEs to 0G Chain, and store verifiable evidence on 0G Storage. Runs as an OpenClaw Skill, Claude Code integration, and Next.js dashboard.

---

## Disclaimer

Research and educational purposes. Not financial advice.

## License

MIT
