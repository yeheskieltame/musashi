# CLAUDE.md — MUSASHI 武蔵

> Development context for Claude Code. Read this before writing any code.

---

## Identity

**MUSASHI (武蔵)** — A conviction-weighted narrative intelligence engine, powered by 0G. Runs as an OpenClaw Skill AND as Claude Code slash commands.

**Architecture:** OpenClaw Skill (SKILL.md) + Claude Code Commands (.claude/commands/) + Go binary (musashi-core) + Solidity (ConvictionLog + MusashiINFT on 0G Chain)

**Key insight:** MUSASHI is NOT a standalone system. It's designed for AI agent runtimes that can investigate, reason, and act. The Go binary handles performance-critical data fetching and gate logic. 0G provides decentralized storage, chain, and agent identity (INFT). The agent (OpenClaw or Claude Code) does the thinking.

**Dual Runtime Support:**
- **OpenClaw:** SKILL.md defines the skill. Agent uses `exec` for Go binary, `browser` for social investigation.
- **Claude Code:** `.claude/commands/` provides slash commands (`/analyze`, `/scan`, `/gates`, `/strike`, `/status`, `/discover`). Agent uses `Bash` for Go binary, `WebSearch`/`WebFetch` for social investigation.

---

## CRITICAL DESIGN RULE: Agents Investigate, Scripts Fetch

**WRONG:**

```python
data = requests.get("https://api.dexscreener.com/...").json()
prompt = f"Analyze: {data}"
response = llm(prompt)  # LLM is just a formatter
```

**RIGHT:** The agent receives a mission. It DECIDES what to investigate. It browses X/Twitter (OpenClaw `browser` or Claude Code `WebSearch`). It runs `musashi-core gates 0x...` for hard data (OpenClaw `exec` or Claude Code `Bash`). It follows leads. It cross-references. It reasons about what it found and decides whether to dig deeper.

The SKILL.md (OpenClaw) and `.claude/commands/` (Claude Code) teach this investigative behavior. The Go binary provides fast, reliable data. The agent does the thinking.

---

## Hackathon Context

**0G APAC Hackathon 2026** — Track 1: Agentic Infrastructure & OpenClaw Lab
**Deadline:** 9 May 2026, 23:59 UTC+8
**Prize:** $150,000 total ($45K first place)

### Submission Requirements (ALL mandatory)

1. **GitHub repo** — public, substantial commits during hackathon period
2. **0G contract address** + Explorer link with verifiable activity (Mainnet)
3. **Demo video** ≤ 3 minutes showing real functionality (not slides)
4. **X post** with #0GHackathon #BuildOn0G @0G*labs @0g_CN @0g_Eco @HackQuest*
5. **README** with architecture, 0G integration explanation, reproduction steps
6. **30-word project description** for HackQuest submission

### Judging Criteria (priority order)

1. **0G Technical Integration Depth & Innovation** — HIGHEST WEIGHT
   - How many 0G components? How deep? Innovative solutions to real pain points?
   - We use 3 components: 0G Storage, 0G Chain (ConvictionLog), INFT (ERC-7857 via MusashiINFT)
2. **Technical Implementation & Completeness** — must actually work
   - Functional code, clean quality, on-chain deployment with Explorer proof
3. **Product Value & Market Potential** — does this solve a real problem?
   - Narrative token analysis = massive retail demand + installable Skill = distribution
4. **UX & Demo Quality** — convincing 3-min video showing real agent behavior
5. **Team & Documentation** — Tessera Juara 1 as track record, comprehensive README

---

## Project Structure

```
musashi/
├── SKILL.md                         ← OpenClaw skill definition
├── .claude/commands/                ← Claude Code slash commands
│   ├── analyze.md                   Full pipeline: gates → specialists → debate → judge
│   ├── scan.md                      Scan, score, rank token opportunities
│   ├── gates.md                     Run 5 automated gates only
│   ├── strike.md                    Publish STRIKE to 0G Chain
│   ├── status.md                    Check on-chain state + reputation
│   └── discover.md                  Raw token discovery with pre-screening
│
├── frontend/                        ← Next.js dashboard (0G Mainnet)
│   ├── src/app/                     Landing page + interactive dashboard
│   ├── src/components/              TokenScanner, StrikeLedger, StrikePublisher,
│   │                                AgentChat, ReputationPanel, GatePipeline,
│   │                                CommandBar, WalletConnect
│   ├── src/lib/contracts.ts         On-chain ABIs + mainnet addresses
│   └── src/lib/wagmi.ts             0G Mainnet chain definition (ID: 16661)
│
├── scripts/
│   ├── musashi-core/                ← Go binary: performance-critical data engine
│   │   ├── cmd/musashi/main.go      CLI entry point (cobra)
│   │   ├── internal/
│   │   │   ├── data/                Free API clients
│   │   │   │   ├── dexscreener.go   Prices, pairs, volume, liquidity
│   │   │   │   ├── geckoterminal.go OHLCV, pools, trades, new pools
│   │   │   │   ├── goplus.go        Honeypot, rug check, contract security
│   │   │   │   ├── defillama.go     TVL, fees, chain metrics, stablecoin flows
│   │   │   │   ├── coingecko.go     Market data, categories, trending, BTC dominance
│   │   │   │   ├── farcaster.go     Farcaster Hub API — casts, mentions
│   │   │   │   └── rpc.go           Multi-chain RPC (go-ethereum)
│   │   │   ├── gates/
│   │   │   │   ├── gate.go          Gate interface + TokenAge/TokenContext (age tiers)
│   │   │   │   ├── contract_safety.go  Gate 1: GoPlus + RPC (strict, no age tiers)
│   │   │   │   ├── liquidity.go        Gate 2: DexScreener + RPC (age-tiered thresholds)
│   │   │   │   ├── wallets.go          Gate 3: RPC + holder analysis (age-tiered + trend)
│   │   │   │   ├── timing.go           Gate 6: DefiLlama + CoinGecko
│   │   │   │   └── cross_validation.go Gate 7: DexScreener vs GeckoTerminal
│   │   │   ├── pipeline/
│   │   │   │   ├── runner.go        Sequential gate execution (age-aware, fail-fast)
│   │   │   │   ├── discovery.go     Raw token discovery (pre-screened)
│   │   │   │   └── scanner.go       Token scanner: fetch → score → rank → optional gates
│   │   │   ├── storage/
│   │   │   │   └── og_storage.go    0G Storage via official 0g-storage-client CLI
│   │   │   └── chain/
│   │   │       ├── conviction.go    0G Chain ConvictionLog contract interaction
│   │   │       └── inft.go          0G Chain MusashiINFT (ERC-7857) interaction
│   │   ├── go.mod
│   │   └── go.sum
│   │
│   ├── gate_check.sh                Shell wrapper: `musashi-core gates <token>`
│   └── publish_strike.sh            Shell wrapper: publish STRIKE to 0G Chain
│
├── prompts/                         Agent system prompts (loaded by SKILL.md)
│   ├── safety_specialist.md         Safety domain — sees Gate 1+2 data only
│   ├── onchain_specialist.md        On-chain domain — sees Gate 3 data only
│   ├── narrative_specialist.md      Narrative domain — agent-driven browsing
│   ├── market_specialist.md         Market domain — sees Gate 6+7 data only
│   ├── musashi_pattern.md           武蔵 Cross-domain pattern detector
│   ├── bull_researcher.md           Builds strongest case FOR
│   ├── bear_researcher.md           Builds strongest case AGAINST
│   └── conviction_judge.md          Binary PASS/FAIL
│
├── contracts/                       Solidity (Foundry)
│   ├── src/ConvictionLog.sol        STRIKE log on 0G Chain (Mainnet)
│   ├── src/MusashiINFT.sol          Agent INFT (ERC-7857) on 0G Chain
│   ├── test/ConvictionLog.t.sol     ConvictionLog tests
│   ├── test/MusashiINFT.t.sol       MusashiINFT tests
│   ├── script/Deploy.s.sol          Deploys both contracts
│   └── foundry.toml                 Config with 0G Mainnet RPC
│
├── references/                      Supporting docs (loaded by agent when needed)
│   ├── GATES.md                     Detailed gate criteria + thresholds
│   ├── PATTERNS.md                  Pattern detection examples + anti-patterns
│   └── API_ENDPOINTS.md             All free API endpoints with examples
│
├── CLAUDE.md                        This file
├── README.md                        Full documentation
├── Makefile                         `make core` `make contracts` `make skill`
└── LICENSE                          MIT
```

### Key Architectural Decisions

1. **Gates 1-3, 6-7 run via Go binary** — hard data, deterministic pass/fail, fast
2. **Gates 2-3 use age-tiered thresholds** — fresh tokens (<24h) have lower minimums; Gate 1 stays strict
3. **Gate 3 does trend analysis** — activity acceleration, buy/sell pressure trends, not just snapshots
4. **`scan` command ranks opportunities** — multi-source fetch → score → rank → optional auto-gates
5. **Gates 4-5 run via agent** — social browsing + narrative analysis need reasoning, not scripts
6. **Specialist analysis + debate happen in agent context** — OpenClaw agent reasons over reports
7. **Evidence stored in 0G Storage** — Go binary uses official `0g-storage-client` CLI (file upload)
8. **STRIKE = early conviction entry signal** — not confirmed momentum. Find before the crowd.
9. **STRIKE published on 0G Chain** — Go binary calls ConvictionLog contract on Mainnet
10. **Agent tokenized as INFT** — MusashiINFT (ERC-7857) links identity + reputation + intelligence

---

## Claude Code Integration

MUSASHI runs natively in Claude Code via custom slash commands in `.claude/commands/`. These map 1:1 to the OpenClaw SKILL.md pipeline.

### Slash Commands

| Command | Description | Equivalent SKILL.md Step |
|---------|-------------|--------------------------|
| `/analyze <token>` | Full 8-step pipeline | Steps 0-8 |
| `/scan [chain] [--gates]` | Scan + score + rank | Token Scanner Mode |
| `/gates <token>` | Run 5 automated gates | Step 1 only |
| `/strike <token> <args>` | Publish STRIKE on-chain | Steps 7-8 |
| `/status` | Check on-chain reputation | Status & History |
| `/discover [chain]` | Raw token discovery | Discovery Mode |

### Tool Mapping (OpenClaw → Claude Code)

| OpenClaw Tool | Claude Code Tool | Usage |
|---------------|------------------|-------|
| `exec` | `Bash` | Run musashi-core binary |
| `browser` | `WebSearch` + `WebFetch` | Social investigation (Gates 4-5, debate) |
| `web_search` | `WebSearch` | Find live evidence |
| `memory` | File-based memory (`~/.claude/`) | Cross-session context |
| `channels` | Telegram MCP / direct output | User communication |

### Running musashi-core in Claude Code

The Go binary is invoked via Bash instead of exec:
```bash
# OpenClaw
exec {baseDir}/scripts/musashi-core/musashi-core gates 0x... --chain 1

# Claude Code
./scripts/musashi-core/musashi-core gates 0x... --chain 1 --output json
```

Build the binary first if needed: `cd scripts/musashi-core && go build -o musashi-core ./cmd/musashi/`

### Social Investigation in Claude Code

Gates 4-5 (Social Momentum, Narrative Alignment) use WebSearch instead of browser:
```
WebSearch: "$SYMBOL token crypto twitter"
WebSearch: "narrative meta AI tokens 2026"
WebFetch: <specific URL for deeper investigation>
```

The agent follows the same investigative logic — it decides what to search, assesses quality, and follows leads.

---

## SKILL.md Specification

The SKILL.md is the heart of the project. It teaches OpenClaw's agent how to run the MUSASHI pipeline.

### Structure

```markdown
---
name: musashi
description: >
  Conviction-weighted token intelligence. Analyze any token through 7 elimination
  gates, cross-domain pattern detection, and adversarial debate. Triggers on
  "analyze token", "musashi scan", "check conviction", "narrative meta".
metadata:
  openclaw:
    requires:
      bins: ["./scripts/musashi-core/musashi-core", "0g-storage-client"]
    primaryEnv: "OG_CHAIN_PRIVATE_KEY"
---

# MUSASHI 武蔵 — Conviction-Weighted Narrative Intelligence

## When to activate

- User asks to analyze a token (address, name, or ticker)
- User asks to scan for new tokens
- User asks about narrative meta or market timing
- User asks about STRIKE history or conviction record

## Pipeline (execute in this exact order)

### Step 1: Gate Check (Go binary)

Run: `./scripts/musashi-core/musashi-core gates <token_address> --chain <chain_id>`
This returns JSON with pass/fail per gate + evidence.
If ANY gate fails → report failure reason to user, STOP.

### Step 2: Specialist Analysis (4 parallel)

For each specialist, load the prompt from prompts/<name>.md,
inject the relevant gate data. Each specialist sees ONLY its domain data.

### Step 3: Musashi Pattern Detection (武蔵)

Load prompts/musashi_pattern.md.
Inject ALL 4 specialist reports.
This produces the PATTERN REPORT with contradictions,
correlations, convergence score, failure points, temporal alignment.

### Step 4: Adversarial Debate

Load bull_researcher.md and bear_researcher.md.
Both receive: 4 specialist reports + pattern report.
Run 2 debate rounds. Both can use browser/web search for live evidence.

### Step 5: Conviction Judge

Load conviction_judge.md. Inject debate transcript + pattern report.
Output: PASS or FAIL. Hesitation = FAIL.

### Step 6: If PASS → STRIKE

Run: `./scripts/musashi-core/musashi-core strike <token> --convergence <N> --evidence <hash>`
This publishes to 0G Chain (ConvictionLog) and 0G Storage.
Report STRIKE to user with on-chain proof link.

### Step 7: Store Evidence

Run: `./scripts/musashi-core/musashi-core store <evidence_json>`
Persists full pipeline output to 0G Storage for cross-session memory.

## Reference files

- Gate criteria: read references/GATES.md when user asks about gate details
- Pattern examples: read references/PATTERNS.md for pattern detection context
- API info: read references/API_ENDPOINTS.md for endpoint details
```

### Key Points About SKILL.md

- OpenClaw reads SKILL.md to understand the capability
- Agent follows the pipeline steps using its existing tools
- `exec` tool runs the Go binary for data-heavy operations
- `browser` tool handles social browsing (Gates 4-5, debate evidence)
- The skill is installable: `openclaw skills install musashi`

---

## Development Phases

### Phase 1: Go Binary — Gate Pipeline [DONE]

13 CLI commands implemented: `scan`, `gates`, `search`, `discover`, `strike`, `store`, `status`, `record-outcome`, `mint-agent`, `update-agent`, `agent-info`, `set-inft`, `history`.

5 automated gates (1,2,3,6,7) with real API data + age-tiered thresholds + trend analysis. Gates 4-5 are agent-driven. `scan` command auto-discovers, scores, and ranks tokens.

### Phase 2: OpenClaw Skill — Agent Intelligence [DONE]

SKILL.md written with full 8-step pipeline. All 8 agent prompts in prompts/.

### Phase 3: 0G Infrastructure — Deep Integration [DONE]

- ConvictionLog + MusashiINFT deployed on Mainnet
- 0G Storage integration via `0g-storage-client` CLI (file upload + merkle proof)
- MUSASHI minted as INFT (token ID 0)
- Full pipeline wired: gates → store evidence → strike with real evidence hash
- Multiple STRIKEs + outcomes recorded on-chain (verifiable activity on Explorer)

### Phase 3.5: Agent Memory — On-Chain Learning [DONE]

- `history` command queries last N strikes + outcomes from ConvictionLog
- Judge prompt receives on-chain track record (win rate, returns, past strikes)
- Judge self-calibrates conviction threshold based on historical performance
- Pattern detector cross-references current analysis against past strike outcomes
- Full feedback loop: analyze → strike → outcome → reputation → calibrate → analyze

### Phase 4: Demo & Polish [CURRENT]

17. Record 3-min demo video showing real agent behavior
18. Create X post with demo clip + required hashtags/tags
19. Final README review
20. Submit on HackQuest

---

## API Reference (All Free)

### GoPlus Security — Gate 1 Primary Source

**Base:** `https://api.gopluslabs.io/api/v1`
**Auth:** None **Limit:** Generous

```
GET /token_security/{chain_id}?contract_addresses={address}

Response includes:
  is_honeypot          → Gate 1: instant fail if true
  is_mintable          → Gate 1: fail if true (mint not revoked)
  can_take_back_ownership → Gate 1: fail if true
  is_proxy             → Gate 1: flag if unaudited proxy
  buy_tax / sell_tax   → Gate 2: fail if sell > buy + 3%
  is_blacklisted       → Gate 1: fail if true
  is_open_source       → Gate 1: flag if not open source
  holder_count         → Gate 3: low count = concentration risk
  lp_holder_count      → Gate 2: check LP distribution
  lp_holders[]         → Gate 2: LP locked status + duration
    .address, .balance, .is_locked, .locked_detail
  is_anti_whale        → informational
  slippage_modifiable  → Gate 1: fail if true
  transfer_pausable    → Gate 1: fail if true
  owner_address        → informational
  creator_address      → Gate 3: track deployer

Chain IDs: ETH=1, BSC=56, Polygon=137, Arbitrum=42161, Base=8453, 0G=16661
```

**Docs:** https://docs.gopluslabs.io/reference/api-overview

### DexScreener — Gates 2, 3, 7

**Base:** `https://api.dexscreener.com`
**Auth:** None **Limit:** ~30 req/min

```
GET /latest/dex/tokens/{tokenAddress}
  → pairs[], each with: priceUsd, volume.h24, liquidity.usd, fdv, marketCap,
    txns.h24.buys, txns.h24.sells, pairCreatedAt

GET /latest/dex/pairs/{chainId}/{pairAddress}
  → detailed pair data

GET /latest/dex/search?q={query}
  → search by name/symbol/address

GET /token-boosts/latest/v1
  → boosted tokens (trending/promoted signal for discovery)
```

**Docs:** https://docs.dexscreener.com/api/reference

### GeckoTerminal — Gates 2, 7

**Base:** `https://api.geckoterminal.com/api/v2`
**Auth:** None **Limit:** 10 calls/min

```
GET /networks/{network}/tokens/{address}
  → token price, volume, market cap

GET /networks/{network}/tokens/{address}/pools
  → all pools (liquidity distribution check)

GET /networks/{network}/pools/{address}/ohlcv/{timeframe}
  → candles (day/hour/minute)

GET /networks/{network}/new_pools
  → discovery: newly created pools

GET /networks/trending_pools
  → trending across networks
```

**Docs:** https://apiguide.geckoterminal.com/

### DefiLlama — Gate 6

**Base:** `https://api.llama.fi`
**Auth:** None **Limit:** Generous

```
GET /v2/chains
  → all chains with current TVL

GET /v2/historicalChainTvl/{chain}
  → historical TVL (trend analysis)

GET /stablecoins
  → stablecoin market caps (macro inflow/outflow signal)

GET /stablecoins/chains
  → stablecoin distribution per chain
```

**Docs:** https://defillama.com/docs/api

### CoinGecko — Gate 6

**Base:** `https://api.coingecko.com/api/v3`
**Auth:** Optional free key **Limit:** 10-30/min

```
GET /global
  → total_market_cap, btc_dominance_percentage (macro signal)

GET /search/trending
  → trending coins (discovery)

GET /coins/categories
  → categories with market data (narrative sector tracking)
```

**Docs:** https://docs.coingecko.com/reference/introduction

### Farcaster Hub — Agent Social Source

**Public Hubs:** various (check docs)
**Neynar search (free tier):** `https://api.neynar.com/v2/farcaster/cast/search?q={query}`
**Auth:** Free API key from neynar.com (optional but useful)

**Docs:** https://docs.farcaster.xyz/reference/hubble/httpapi
**Neynar Docs:** https://docs.neynar.com/reference

### Chain RPCs (free public)

```
Ethereum:  https://eth.llamarpc.com
BSC:       https://bsc-dataseed.binance.org
Polygon:   https://polygon-rpc.com
Arbitrum:  https://arb1.arbitrum.io/rpc
Base:      https://mainnet.base.org
0G Chain:  https://evmrpc.0g.ai
```

---

## 0G SDK Reference

### 0G Storage (CLI)

**CLI Docs:** https://docs.0g.ai/developer-hub/building-on-0g/storage/storage-cli
**SDK Docs:** https://docs.0g.ai/developer-hub/building-on-0g/storage/sdk

```bash
# File upload (evidence archive):
0g-storage-client upload \
  --url https://evmrpc.0g.ai \
  --key $OG_CHAIN_PRIVATE_KEY \
  --indexer https://indexer-storage-turbo.0g.ai \
  --file evidence.json

# File download (with merkle proof verification):
0g-storage-client download \
  --indexer https://indexer-storage-turbo.0g.ai \
  --root <root_hash> \
  --file output.json \
  --proof
```

### 0G Chain — Mainnet (EVM — Foundry)

**Docs:** https://docs.0g.ai/developer-hub/building-on-0g/0g-chain
**Network:** 0G-Mainnet | Chain ID: 16661
**RPC:** https://evmrpc.0g.ai
**Explorer:** https://chainscan.0g.ai

```bash
# NOTE: `forge script` does NOT work with 0G Chain (chain 16661 unsupported).
# Use `forge create` + `cast send` instead:

# Step 1: Deploy ConvictionLog
forge create src/ConvictionLog.sol:ConvictionLog \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $OG_CHAIN_PRIVATE_KEY --legacy --broadcast

# Step 2: Deploy MusashiINFT (needs ConvictionLog address)
forge create src/MusashiINFT.sol:MusashiINFT \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $OG_CHAIN_PRIVATE_KEY --legacy --broadcast \
  --gas-limit 3000000 --constructor-args <CONVICTION_LOG_ADDRESS>

# Step 3: Link them
cast send <CONVICTION_LOG_ADDRESS> "setINFT(address)" <INFT_ADDRESS> \
  --rpc-url https://evmrpc.0g.ai \
  --private-key $OG_CHAIN_PRIVATE_KEY --legacy

# SAVE deployed addresses — needed for submission
# SAVE Explorer links — needed for submission
```

### INFT — Intelligent NFT (ERC-7857, Agent Tokenization)

**Docs:** https://docs.0g.ai/developer-hub/building-on-0g/inft/inft-overview
**Standard:** https://docs.0g.ai/developer-hub/building-on-0g/inft/erc7857
**Integration:** https://docs.0g.ai/developer-hub/building-on-0g/inft/integration
**GitHub:** https://github.com/0gfoundation/0g-agent-nft/tree/eip-7857-draft

MUSASHI is tokenized as an INFT via MusashiINFT contract. Links identity → reputation → intelligence config.
- Encrypted metadata storage (config + prompts hash in 0G Storage)
- Dynamic updates (win rate synced from ConvictionLog after each STRIKE)
- Clone function (replicate agent with same intelligence)
- Authorized usage (grant time-limited access to executor addresses)

### All 0G Resources

| Resource          | URL                                                         |
| ----------------- | ----------------------------------------------------------- |
| Main docs         | https://docs.0g.ai                                         |
| SDKs              | https://build.0g.ai/sdks/                                  |
| Explorer          | https://chainscan.0g.ai                                     |
| Storage Explorer  | https://storagescan.0g.ai                                   |
| GitHub            | https://github.com/0glabs                                   |
| INFT GitHub       | https://github.com/0gfoundation/0g-agent-nft               |
| Community         | https://github.com/0gfoundation/awesome-0g                 |

---

## Deployed Contracts

Both contracts deployed on 0G Mainnet (Chain ID: 16661):

| Contract | Address |
|----------|---------|
| ConvictionLog | `0x2B84aC25498FF0157fAB04fEa9e3544A14882A15` |
| MusashiINFT | `0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c` |

### ConvictionLog.sol (deployed version)

Packed storage (4 slots per strike). O(1) cached reputation (no loops). Ownable2Step + Pausable.

Key types and functions — **note `uint64 chainId` and `int128 outcomeBps`, NOT uint256/int256**:

```solidity
struct Strike {
    address token;       // slot 0: token(20) + convergence(1) + outcomeFilled(1)
    uint8   convergence;
    bool    outcomeFilled;
    bytes32 evidenceHash; // slot 1
    uint64  chainId;      // slot 2: chainId(8) + timestamp(6) + outcomeBps(16)
    uint48  timestamp;
    int128  outcomeBps;
    uint256 agentId;     // slot 3
}

// Per-agent reputation (2 slots)
struct AgentReputation {
    uint64 strikeCount;
    uint64 totalFilled;
    uint64 wins;
    uint64 losses;
    int128 totalReturnBps;
}

// Cached global reputation state (O(1), updated in recordOutcome)
uint64  public totalStrikes;
uint64  public totalFilled;
uint64  public wins;
uint64  public losses;
int128  public totalReturnBps;

function logStrike(uint256 _agentId, address _token, uint64 _chainId, uint8 _convergence, bytes32 _evidenceHash)
function recordOutcome(uint256 _id, int128 _returnBps)
function getStrike(uint256 _id) → Strike memory
function strikeCount() → uint256
function reputation() → (uint256 total, uint256 w, uint256 l, int256 totalReturn)
function agentReputation(uint256 _agentId) → (uint256 strikes, uint256 filled, uint256 w, uint256 l, int256 totalReturn)
```

### MusashiINFT.sol (ERC-7857 compliant — current version)

Real ERC-7857 semantics: encrypted intelligence bundle on 0G Storage, per-owner ECIES-sealed symmetric key, oracle-verified transfers/clones. Linked to ConvictionLog (immutable). Ownable2Step + Pausable + ReentrancyGuard.

```solidity
struct AgentToken {
    address owner;             // slot 0: owner(20) + active(1) + winRate(2) + convergenceAvg(1) + version(2)
    bool    active;
    uint16  winRate;
    uint8   convergenceAvg;
    uint16  version;           // bumped on every re-seal (transfer/clone/update) — replay protection
    bytes32 storageRoot;       // slot 1: 0G Storage merkle root of the AES-256-CTR encrypted bundle
    bytes32 metadataHash;      // slot 2: commitment to the public descriptor JSON
    uint64  totalStrikes;      // slot 3: totalStrikes(8) + createdAt(6) + updatedAt(6)
    uint48  createdAt;
    uint48  updatedAt;
    string  name;
}

// per-token ECIES-wrapped AES key, rotated on every re-seal
mapping(uint256 => bytes) public sealedKey;

// trusted ECDSA re-encryption oracle (TEE/ZKP in production, deployer key for hackathon)
address public oracle;

function mint(string calldata _name, bytes32 _storageRoot, bytes32 _metadataHash, bytes calldata _sealedKey)
function updateIntelligence(uint256 tokenId, bytes32 newStorageRoot, bytes calldata newSealedKey)
function transfer(uint256 tokenId, address to, bytes32 newStorageRoot, bytes calldata newSealedKey, bytes calldata oracleProof)
function clone(uint256 tokenId, address newOwner, bytes32 newStorageRoot, bytes calldata newSealedKey, bytes calldata oracleProof)
function authorizeUsage(uint256 tokenId, address executor, uint48 duration, bytes32 permissionsHash)
function revokeUsage(uint256 tokenId, address executor)
function setOracle(address _oracle) external onlyOwner
function transferDigest(uint256 tokenId, uint16 version, bytes32 oldRoot, bytes32 newRoot, address to) → bytes32
function getAgent(uint256 tokenId) → AgentToken memory
function getSealedKey(uint256 tokenId) → bytes memory
function agentCount() → uint256

event SealedTransfer(uint256 indexed id, address indexed from, address indexed to, bytes32 oldRoot, bytes32 newRoot, uint16 newVersion);
event IntelligenceUpdated(uint256 indexed id, bytes32 newStorageRoot, uint64 totalStrikes, uint16 winRate);
event AgentCloned(uint256 indexed originalId, uint256 indexed newId, address indexed newOwner, bytes32 newRoot);
```

The oracle proof is an ECDSA signature over `keccak256(abi.encode(chainid, address(this), tokenId, version, oldRoot, newRoot, to))` wrapped with the EIP-191 `"\x19Ethereum Signed Message:\n32"` prefix. Any transfer / clone with a newRoot equal to oldRoot reverts (`StaleRoot`), and any signature produced for a stale `(version, oldRoot)` pair is rejected after `version` bumps.

**IMPORTANT for Go binary ABI encoding:** `logStrike` uses `uint256` for agentId and `uint64` for chainId. The function selector is `keccak256("logStrike(uint256,address,uint64,uint8,bytes32)")`. Using the wrong types in the selector will cause a revert.

---

## Agent Prompts Summary

Full prompts are in `prompts/` directory. Key design:

| Agent                | Domain               | Tools (OpenClaw built-in) | Key Instruction                                                        |
| -------------------- | -------------------- | ------------------------- | ---------------------------------------------------------------------- |
| Safety Specialist    | Gate 1+2 data        | exec (Go binary)          | Analyze GoPlus + RPC results, assess safety                            |
| On-Chain Specialist  | Gate 3 data          | exec (Go binary)          | Analyze wallet distribution, fresh wallet %, smart money               |
| Narrative Specialist | Social + narrative   | browser, web search       | BROWSE X/Twitter, Farcaster. Read actual posts. Assess organic vs bot. |
| Market Specialist    | Gate 6+7 data        | exec (Go binary)          | Assess macro timing, cross-validate data sources                       |
| 武蔵 Musashi         | All 4 reports        | none (pure reasoning)     | Find cross-domain patterns INVISIBLE to individuals                    |
| Bull Researcher      | All + pattern report | browser, web search       | Build strongest case FOR with live evidence                            |
| Bear Researcher      | All + pattern report | browser, web search       | Build strongest case AGAINST with live evidence                        |
| Conviction Judge     | Debate + pattern     | none (pure reasoning)     | PASS or FAIL. Hesitation = FAIL.                                       |

**Narrative specialist and researchers actively browse the web during analysis.** They're not processing pre-fetched data — they investigate.

---

## Environment

```bash
# .env — see .env.example for template

# 0G Chain — Mainnet (Chain ID: 16661)
OG_CHAIN_RPC=https://evmrpc.0g.ai
OG_CHAIN_PRIVATE_KEY=         # Deployer wallet (hex, 0x prefix accepted)

# Deployed contracts
CONVICTION_LOG_ADDRESS=0x2B84aC25498FF0157fAB04fEa9e3544A14882A15
MUSASHI_INFT_ADDRESS=0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c

# 0G Storage — uses official 0g-storage-client CLI (file upload)
OG_STORAGE_RPC=https://evmrpc.0g.ai
OG_STORAGE_INDEXER=https://indexer-storage-turbo.0g.ai
```

**No paid external API keys.** All data APIs are free. Social analysis is agent-driven browsing.
**0G faucet (testnet only):** https://faucet.0g.ai (not applicable for mainnet)
**Private key:** The Go binary strips `0x` prefix automatically if present.

---

## Demo Storyline (3 min video)

```
0:00  "500 new tokens launched this week."
0:15  Show OpenClaw running: user messages "musashi scan"
0:30  Agent runs musashi-core gates → 485 eliminated in seconds
0:45  Show a trap: agent browses X/Twitter, finds +400% mentions
1:00  Agent runs on-chain analysis → 80% fresh wallets
1:15  Musashi pattern overlay: "manufactured hype → ELIMINATE"
1:30  Show the ace card: quiet token, 4/4 convergence
1:45  Bull/Bear debate with live evidence search
2:00  Judge: PASS → STRIKE
2:15  On-chain: ConvictionLog transaction on 0G Explorer
2:30  Evidence stored in 0G Storage, Agent ID updated
2:45  "openclaw skills install musashi — anyone can use this"
3:00  End with track record: X strikes, Y% win rate, on-chain proof
```

---

## Key Reminders

1. **SKILL.md + .claude/commands/ are the product.** Installable OpenClaw Skill AND Claude Code slash commands.
2. **Don't rebuild agent runtime features.** Both OpenClaw and Claude Code provide tools natively. Use them.
3. **Go binary for data, agent for reasoning.** Gates 1-3, 6-7 = Go. Gates 4-5 = agent browsing.
4. **0G Storage for evidence.** File upload via official CLI. Merkle root hash stored on-chain.
6. **2 contracts deployed, 0G Mainnet, real activity.** ConvictionLog + MusashiINFT both live with verifiable transactions.
7. **INFT for deep 0G integration.** ERC-7857 tokenized agent identity + reputation on-chain. MUSASHI minted as token ID 0.
8. **Free APIs only.** No Twitter API key. Agent browses public X/Twitter via OpenClaw browser.
9. **Frontend dashboard exists.** Next.js app with wallet connect, strike ledger, reputation panel, token scanner. 3-min demo video should show both CLI and dashboard.
10. **Ship working code.** Judges check commits. Better to have 5 gates working perfectly than 7 gates half-broken.
11. **Agent Memory is on-chain.** `history` command reads past strikes + outcomes from ConvictionLog. Judge uses this to self-calibrate. This is the learning loop that makes MUSASHI a true agent, not just an automation script.
11. **Go binary accepts 0x prefix on private keys.** `stripHexPrefix()` handles both formats.
12. **GoPlus returns holder_count as string, not int.** All GoPlus numeric fields use string type in the Go struct.

---

## Links

### 0G

- Docs: https://docs.0g.ai
- SDKs: https://build.0g.ai/sdks/
- Explorer: https://chainscan.0g.ai/
- GitHub: https://github.com/0glabs
- Community: https://github.com/0gfoundation/awesome-0g

### OpenClaw

- Repo: https://github.com/openclaw/openclaw
- Docs: https://docs.openclaw.ai
- Skills: https://docs.openclaw.ai/tools/skills
- Skill creator: https://github.com/openclaw/openclaw/blob/main/skills/skill-creator/SKILL.md

### Free APIs

- DexScreener: https://docs.dexscreener.com/api/reference
- GeckoTerminal: https://apiguide.geckoterminal.com/
- GoPlus: https://docs.gopluslabs.io/reference/api-overview
- DefiLlama: https://defillama.com/docs/api
- CoinGecko: https://docs.coingecko.com/reference/introduction
- Farcaster: https://docs.farcaster.xyz/reference/hubble/httpapi
- Neynar: https://docs.neynar.com/reference

### Inspiration

- Tessera: https://github.com/yeheskieltame/Tessera
- TradingAgents: https://github.com/TauricResearch/TradingAgents
