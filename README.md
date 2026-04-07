# MUSASHI

**The First On-Chain Reputation Protocol for AI Agents -- Built on 0G**

_"A thousand tokens watched. One conviction taken. Every call on-chain."_

MUSASHI is two things:

1. **A token analysis skill** -- an OpenClaw Skill that runs tokens through 7 elimination gates, 4 specialist analyses, cross-domain pattern detection, and adversarial debate. 97% of tokens get eliminated.

2. **A reputation protocol** -- any AI agent can mint an INFT identity, submit conviction signals (STRIKEs) to 0G Chain, store verifiable evidence on 0G Storage, and build an on-chain track record. No self-reported stats. No trust-me-bro. Every call, every outcome, every win and loss -- on-chain and verifiable.

### Why This Matters

ERC-7857 gives AI agents **identity** (INFT). But identity without reputation is meaningless. If there are 100 agents on a marketplace, which one do you trust? The one with a **verifiable track record**: 50 strikes, 35 wins, +4200 bps cumulative return -- all on-chain, all backed by downloadable evidence with merkle proofs.

MUSASHI builds the missing **reputation layer** for 0G's agent ecosystem.

---

## Deployed Contracts (0G Galileo Testnet)

| Contract | Address | Explorer |
|----------|---------|----------|
| ConvictionLog | `0x7698c369Cec5bFD14bFe9184ea19D644540f483b` | [View](https://chainscan-galileo.0g.ai/address/0x7698c369Cec5bFD14bFe9184ea19D644540f483b) |
| MusashiINFT | `0xFB1Cd4b556eCA02D84BA3754Fbd4Fe2C81aEE488` | [View](https://chainscan-galileo.0g.ai/address/0xFB1Cd4b556eCA02D84BA3754Fbd4Fe2C81aEE488) |

Network: 0G-Galileo-Testnet, Chain ID: 16602

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
                         ANALYSIS ENGINE (OpenClaw Skill)
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
| Skill | SKILL.md | Teaches the OpenClaw agent HOW to investigate tokens |
| Engine | musashi-core (Go) | High-performance data engine. Gates 1-3, 6-7. Publishes STRIKEs. |
| Agent | OpenClaw runtime | Gates 4-5 (social browsing), specialists, debate, judge |
| Protocol | ConvictionLog.sol | Multi-agent STRIKE log. Per-agent + global reputation. |
| Identity | MusashiINFT.sol | ERC-7857 agent INFT. Identity + reputation + intelligence on-chain. |
| Evidence | 0G Storage | Decentralized evidence archive. Merkle proofs for verification. |

---

## Gate Pipeline

Sequential elimination. Fail one gate, get eliminated. No exceptions.

| Gate | Name | Source | Fail Conditions |
|------|------|--------|-----------------|
| 1 | Contract Safety | GoPlus API | Honeypot, mintable, ownership takeback, blacklist, pausable transfers, modifiable slippage, sell tax >5%, asymmetric tax (sell > buy + 3%), unaudited proxy |
| 2 | Liquidity Structure | DexScreener, GoPlus | No DEX pairs, liquidity <$10K, LP depth <5% of mcap, no locked LP, 24h volume <$1K |
| 3 | Wallet Behavior | DexScreener, GoPlus | <50 holders, no transactions in 24h, sell ratio >70%, <20 txns/24h, 1h sell dump >80% |
| 4 | Social Momentum | Agent browsing | Agent browses X/Twitter, Farcaster. Assesses organic vs bot, velocity, quality. No API keys. |
| 5 | Narrative Alignment | Agent browsing | Agent researches narrative meta, lifecycle stage, competition, catalysts. |
| 6 | Market Timing | CoinGecko, DefiLlama | Market cap 24h drop >8%, chain TVL decline >15% (7d) or >30% (30d) |
| 7 | Cross-Validation | DexScreener, GeckoTerminal | Both sources fail, price divergence >10%, volume divergence >50% |

Gates 1-3, 6-7 run via the Go binary. Gates 4-5 run via the OpenClaw agent's browser tool.

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

## 0G Integration (3 Components, Deep)

### 0G Chain -- ConvictionLog (Reputation Protocol)

**The core protocol.** Any INFT-holding agent can log conviction STRIKEs. Each strike records: which agent (`agentId`), which token, which chain, convergence score, and evidence hash (link to 0G Storage).

- **Per-agent reputation** -- `agentReputation(agentId)` returns strikes, wins, losses, cumulative return for a specific agent
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
| Farcaster/Neynar | Casts, mentions, social signals | Agent social analysis |
| Public RPCs | On-chain reads (balance, code, ERC20 calls) | Gate support |

Social analysis (X/Twitter, Telegram) is done via OpenClaw's browser tool -- no paid API subscriptions.

---

## Setup

### Prerequisites

- Go 1.21+
- Foundry (forge, cast)
- `0g-storage-client` CLI

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

Edit `.env` and set your private key:

```
OG_CHAIN_RPC=https://evmrpc-testnet.0g.ai
OG_CHAIN_PRIVATE_KEY=your_private_key_here
CONVICTION_LOG_ADDRESS=0x7698c369Cec5bFD14bFe9184ea19D644540f483b
MUSASHI_INFT_ADDRESS=0xFB1Cd4b556eCA02D84BA3754Fbd4Fe2C81aEE488
OG_STORAGE_RPC=https://evmrpc-testnet.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-testnet-turbo.0g.ai
```

Get testnet tokens from [faucet.0g.ai](https://faucet.0g.ai/).

### Load Environment

All commands below assume environment is loaded:

```bash
set -a && source .env && set +a
```

---

## CLI Reference

### musashi-core commands

| Command | Description | Example |
|---------|-------------|---------|
| `gates` | Run elimination gates on a token | `musashi-core gates 0x2260FA...99 --chain 1 --output json` |
| `search` | Search token by name/ticker | `musashi-core search "PEPE" --limit 5` |
| `strike` | Publish STRIKE to ConvictionLog | `musashi-core strike 0x2260FA...99 --agent-id 0 --convergence 4 --evidence <hash>` |
| `store` | Upload evidence JSON to 0G Storage | `musashi-core store '{"token":"0x...","analysis":"..."}' ` |
| `discover` | Scan for new tokens | `musashi-core discover --chain 1 --limit 20` |
| `status` | Query global or per-agent reputation | `musashi-core status` or `musashi-core status --per-agent --agent-id 0` |
| `record-outcome` | Record STRIKE outcome | `musashi-core record-outcome --strike-id 0 --return-bps 500` |
| `set-inft` | Link MusashiINFT to ConvictionLog (one-time) | `musashi-core set-inft 0xFB1C...488` |
| `mint-agent` | Mint agent INFT | `musashi-core mint-agent --name MUSASHI --config-hash <hash> --intelligence-hash <hash>` |
| `update-agent` | Update agent intelligence + sync reputation | `musashi-core update-agent --token-id 0 --intelligence-hash <hash>` |
| `agent-info` | Query INFT agent state | `musashi-core agent-info --token-id 0` |

### Full flag reference

```
musashi-core gates [token_address]
  --chain int64        Chain ID: 1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base (default 1)
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
make deploy            # Deploy contracts to 0G Galileo Testnet
make gates TOKEN=0x... CHAIN=1        # Run gates on a token
make discover CHAIN=1 LIMIT=20       # Discover new tokens
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
# 1. Run gates
musashi-core gates 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 --chain 1 --output json > evidence.json

# 2. Store evidence to 0G Storage
musashi-core store "$(cat evidence.json)"
# Returns: { "root_hash": "0xabc...", "storage_scan": "https://storagescan-galileo.0g.ai/file/0xabc..." }

# 3. Publish STRIKE with evidence hash and agent ID
musashi-core strike 0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599 \
  --agent-id 0 \
  --convergence 4 \
  --evidence abc123...  \
  --token-chain 1
# Returns: { "tx_hash": "0x...", "explorer_url": "https://chainscan-galileo.0g.ai/tx/0x..." }

# 4. Check per-agent reputation
musashi-core status --per-agent --agent-id 0
# Returns: { "agent_id": 0, "strikes": 1, "wins": 0, "losses": 0, ... }

# 5. Check global reputation (all agents)
musashi-core status
# Returns: { "strike_count": 1, "wins": 0, "losses": 0, ... }

# 6. Record outcome later (owner only — outcomes are objective facts)
musashi-core record-outcome --strike-id 0 --return-bps 1200

# 7. Sync reputation to INFT
musashi-core update-agent --token-id 0 --intelligence-hash <new_hash>
```

### OpenClaw Skill usage

```bash
openclaw skills install musashi
```

Then message your agent:

```
"Analyze token 0x1234 on Base"
"Scan for new tokens with conviction potential"
"What's the current narrative meta?"
"Show my STRIKE history"
```

---

## Project Structure

```
musashi/
├── SKILL.md                         OpenClaw skill definition (entry point)
├── scripts/
│   ├── musashi-core/                Go binary source
│   │   ├── cmd/musashi/main.go      CLI entry (11 commands)
│   │   └── internal/
│   │       ├── data/                API clients: goplus, dexscreener, geckoterminal,
│   │       │                        coingecko, defillama, farcaster, rpc
│   │       ├── gates/               Gate implementations: contract_safety, liquidity,
│   │       │                        wallets, timing, cross_validation
│   │       ├── pipeline/            Sequential gate runner + token discovery
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

| Variable | Required | Description |
|----------|----------|-------------|
| `OG_CHAIN_RPC` | No | 0G Chain RPC (default: `https://evmrpc-testnet.0g.ai`) |
| `OG_CHAIN_PRIVATE_KEY` | Yes (for writes) | Deployer wallet private key (hex, with or without 0x prefix) |
| `CONVICTION_LOG_ADDRESS` | Yes | ConvictionLog contract address |
| `MUSASHI_INFT_ADDRESS` | Yes | MusashiINFT contract address |
| `OG_STORAGE_RPC` | No | 0G Storage RPC (default: `https://evmrpc-testnet.0g.ai`) |
| `OG_STORAGE_INDEXER` | No | 0G Storage indexer (default: `https://indexer-storage-testnet-turbo.0g.ai`) |

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
- [x] 0G testnet contract addresses + Explorer links with verifiable activity
- [x] 0G Storage integration with evidence uploads
- [x] INFT (ERC-7857) agent tokenization
- [x] README with architecture + 0G integration explanation + setup guide
- [ ] Demo video (3 minutes max)
- [ ] Public X post with #0GHackathon #BuildOn0G

### Inspiration

| Source | What MUSASHI Takes |
|--------|-------------------|
| [Tessera](https://github.com/yeheskieltame/Tessera) | Gate elimination, Go binary, evidence pipeline |
| [TradingAgents](https://github.com/TauricResearch/TradingAgents) | Specialist roles, adversarial debate |
| [OpenClaw](https://github.com/openclaw/openclaw) | Skill system, agent tools, distribution |

---

## Disclaimer

Research and educational purposes. Not financial advice.

## License

MIT
