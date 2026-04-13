# MUSASHI 武蔵

**Conviction-Weighted Token Intelligence — Built on 0G**

_"Find early, strike with conviction. A thousand tokens watched. One conviction taken. Every call on-chain."_

MUSASHI is a conviction-weighted token intelligence engine. It investigates tokens through a 7-gate elimination pipeline, 4 parallel specialists, cross-domain pattern detection, and adversarial debate — then publishes only the rare survivors as on-chain STRIKEs backed by verifiable evidence. 97% of tokens fail. The philosophy is simple: **if everyone already knows about it, you're too late.**

Because every STRIKE is a transaction on 0G Chain and every analysis is stored on 0G Storage, MUSASHI accumulates an immutable track record as it runs. The agent itself is tokenized as an INFT (ERC-7857) whose on-chain reputation — win rate, cumulative return, past calls — is readable by anyone. No self-reported stats. No trust-me-bro. The reputation layer is a natural consequence of the intelligence engine, not a separate product.

**Live dashboard:** https://musashi-agent.xyz

---

## Problem

Narrative-driven crypto traders face four problems:

| Problem                | Description                                                                                                                                                                   |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Signal overload        | Hundreds of new tokens daily. No human cross-references contract safety, wallet behavior, social momentum, and market timing simultaneously.                                  |
| Confirmation bias      | Find one bullish signal, stop looking. Existing tools generate signals, not eliminate them.                                                                                   |
| No framework           | Stock traders have P/E ratios. Meme traders have vibes and Telegram alpha.                                                                                                    |
| The specialist problem | Social mentions +400% looks bullish. But 80% of buyers are fresh wallets. No single analyst catches this — the pattern is invisible until someone overlays both perspectives. |

MUSASHI runs 7 elimination gates sequentially (fail-fast), hands the survivors to 4 parallel domain specialists, overlays a cross-domain pattern detector, and puts the result through bull/bear adversarial debate before a conviction judge. Only tokens that clear every filter and survive adversarial cross-examination become a STRIKE.

---

## Deployed Contracts (0G Mainnet, Chain ID 16661)

| Contract               | Address                                                                                                                    |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| ConvictionLog          | [`0x2B84aC25498FF0157fAB04fEa9e3544A14882A15`](https://chainscan.0g.ai/address/0x2B84aC25498FF0157fAB04fEa9e3544A14882A15) |
| MusashiINFT (ERC-7857) | [`0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c`](https://chainscan.0g.ai/address/0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c) |

Analysis supports Ethereum, BSC, Polygon, Arbitrum, Base, and 0G Chain.

---

## Quick Start

### Prerequisites

- Go 1.26+
- Foundry (`curl -L https://foundry.paradigm.xyz | bash && foundryup`)
- `0g-storage-client` CLI (only for evidence upload / publish mode)

### Install & build

```bash
git clone https://github.com/yeheskieltame/musashi.git
cd musashi
make core
cp .env.example .env    # fill in contract addresses (required)
set -a && source .env && set +a
```

Analysis mode (gates, scan, discover, history) works without a private key. Only publishing commands (`strike`, `store`, `mint-agent`, `update-agent`, `set-inft`) need `OG_CHAIN_PRIVATE_KEY` set to a **dedicated wallet with minimal funds**.

### Run your first scan

```bash
./scripts/musashi-core/musashi-core scan --chain 8453 --limit 10 --gates
./scripts/musashi-core/musashi-core gates 0x1234...abcd --chain 1
```

---

## Runtimes

MUSASHI ships as a single analysis engine runnable from three places. Pick whichever matches your workflow.

### Claude Code

Slash commands in `.claude/commands/` — work out of the box after `make core`.

| Command                   | Description                                                          |
| ------------------------- | -------------------------------------------------------------------- |
| `/hunt [chain]`           | "Just tell me what to strike" — end-to-end funnel, ranked recommendations |
| `/analyze <token>`        | Full 8-step pipeline: gates → specialists → pattern → debate → judge |
| `/scan [chain] [--gates]` | Scan, score, and rank opportunities                                  |
| `/gates <token>`          | Run the 5 automated gates (1,2,3,6,7) via Go binary                  |
| `/discover [chain]`       | Raw token discovery with pre-screening                               |
| `/strike <token>`         | Publish a STRIKE conviction to 0G Chain                              |
| `/status`                 | On-chain reputation and agent state                                  |

Companion skill: `skills/coingecko/` is the official CoinGecko Agent SKILL bundled in the repo. Install once with `cp -r skills/coingecko ~/.claude/skills/` — narrative + market specialists use it for typed access to CoinGecko and GeckoTerminal endpoints.

### OpenClaw

```bash
openclaw skills install musashi
```

Minimal `openclaw.json` config (analysis only, no wallet needed):

```json
{
  "skills": {
    "entries": {
      "musashi": {
        "env": {
          "OG_CHAIN_RPC": "https://evmrpc.0g.ai",
          "CONVICTION_LOG_ADDRESS": "0x2B84aC25498FF0157fAB04fEa9e3544A14882A15",
          "MUSASHI_INFT_ADDRESS": "0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c"
        }
      }
    }
  }
}
```

For on-chain publishing add `OG_CHAIN_PRIVATE_KEY`, `OG_STORAGE_RPC`, `OG_STORAGE_INDEXER`. Install the coingecko companion skill with `openclaw skills install ./skills/coingecko`.

Invoke with natural language: _"Scan Base for the best opportunities"_, _"Analyze 0x1234 on Base"_, _"Show my STRIKE history"_.

### Next.js dashboard

```bash
cd frontend && pnpm install && pnpm dev
```

Connects directly to the mainnet contracts. Canonical deployment lives at [musashi-agent.xyz](https://musashi-agent.xyz).

---

## CLI Reference

All commands live under `./scripts/musashi-core/musashi-core`. Full flag details: `musashi-core <cmd> --help`.

| Command               | Purpose                                                            |
| --------------------- | ------------------------------------------------------------------ |
| `scan`                | Fetch, score, and rank tokens across chains                        |
| `gates <token>`       | Run elimination gates on a specific token                          |
| `search <query>`      | Search tokens by name/ticker                                       |
| `discover`            | Raw token discovery (new / trending pools)                         |
| `orchestrate <token>` | Gates → 0G Storage → STRIKE in one command, gated on judge verdict |
| `strike <token>`      | Publish STRIKE to ConvictionLog                                    |
| `store <json>`        | Upload evidence JSON to 0G Storage                                 |
| `verify`              | Download + verify evidence with merkle proof                       |
| `status`              | Global or per-agent reputation                                     |
| `history`             | Strike history + reputation (agent memory)                         |
| `record-outcome`      | Record realized STRIKE return (owner only)                         |
| `seal-intelligence`   | Encrypt + upload intelligence bundle, emit sealed key              |
| `mint-agent`          | Mint agent INFT (ERC-7857)                                         |
| `update-agent`        | Rotate agent intelligence + sync reputation                        |
| `transfer-agent`      | Sealed ERC-7857 transfer (oracle-signed re-seal)                   |
| `agent-info`          | Query INFT agent state                                             |

Convenience Makefile targets: `make core`, `make contracts`, `make test`, `make gates TOKEN=... CHAIN=...`, `make scan CHAIN=... LIMIT=...`, `make status`, `make agent-info TOKEN_ID=...`.

### Pipeline example

```bash
# Analyze
./scripts/musashi-core/musashi-core gates 0x2260FA...99 --chain 1 --output json > evidence.json

# Store evidence on 0G Storage, capture root_hash
./scripts/musashi-core/musashi-core store "$(cat evidence.json)"

# Publish STRIKE with evidence hash
./scripts/musashi-core/musashi-core strike 0x2260FA...99 \
  --agent-id 0 --convergence 4 --evidence <root_hash> --token-chain 1

# Record outcome later
./scripts/musashi-core/musashi-core record-outcome --strike-id 0 --return-bps 1200

# Query agent memory for self-calibration
./scripts/musashi-core/musashi-core history --agent-id 0 --limit 12
```

---

## Data sources (all free, no API keys required)

GoPlus Security · DexScreener · GeckoTerminal · DefiLlama · CoinGecko · Farcaster Hub · public chain RPCs.

Social investigation (Gates 4-5) is agent-driven via WebSearch / WebFetch (Claude Code) or `browser` (OpenClaw) — the agent reads real X/Twitter, Farcaster, and Telegram posts instead of querying a paid API.

---

## 0G Integration

Three components, used for real:

- **0G Chain — ConvictionLog** — every STRIKE is a transaction. Packed storage (4 slots per strike), O(1) cached reputation, Ownable2Step + Pausable. Tracks per-agent win rate, returns, and strike history.
- **0G Chain — MusashiINFT (ERC-7857)** — the agent itself is tokenized. Encrypted intelligence bundle on 0G Storage, per-owner ECIES-sealed AES key, oracle-verified transfers/clones, dynamic reputation sync from ConvictionLog. MUSASHI is minted as token ID 0.
- **0G Storage** — evidence archive. Every STRIKE references a merkle root; anyone can download the raw pipeline output and verify it hasn't been tampered with.

Agent memory closes the loop: the judge reads past strikes + outcomes from ConvictionLog before every decision and self-calibrates its conviction threshold based on historical win rate.

---

## Environment Variables

| Variable                 | Mode    | Description                                                        |
| ------------------------ | ------- | ------------------------------------------------------------------ |
| `OG_CHAIN_RPC`           | both    | 0G Chain RPC endpoint                                              |
| `CONVICTION_LOG_ADDRESS` | both    | ConvictionLog contract address                                     |
| `MUSASHI_INFT_ADDRESS`   | both    | MusashiINFT contract address                                       |
| `OG_CHAIN_PRIVATE_KEY`   | publish | Dedicated wallet key (hex, 0x optional)                            |
| `OG_STORAGE_RPC`         | publish | 0G Storage RPC (default `https://evmrpc.0g.ai`)                    |
| `OG_STORAGE_INDEXER`     | publish | 0G Storage indexer (default `https://indexer-storage-turbo.0g.ai`) |

Without a private key, publishing commands return `analysis_only` / `skipped` instead of erroring.

---

## Credits

Built by [@YeheskielTame](https://x.com/YeheskielTame) for the 0G APAC Hackathon 2026 — Track 1: Agentic Infrastructure & OpenClaw Lab.

Inspiration: [TradingAgents](https://github.com/TauricResearch/TradingAgents) (specialist roles + adversarial debate), [OpenClaw](https://github.com/openclaw/openclaw) (skill system + distribution).

---

## License

[MIT](./LICENSE)
