# MUSASHI — Scan for Token Opportunities

Scan, score, and rank tokens to find the best early-stage opportunities.

**Arguments:** $ARGUMENTS

## Execution

Parse the arguments for optional chain and flags. Default: all chains, limit 10.

### Basic Scan (score + rank)

```bash
./scripts/musashi-core/musashi-core scan --chain <chain_id> --limit <n>
```

### Scan with Auto-Gates (deeper analysis)

If user asks for deep scan, thorough scan, or includes "gates":

```bash
./scripts/musashi-core/musashi-core scan --chain <chain_id> --limit <n> --gates
```

This runs the full gate pipeline on the top 5 candidates automatically.

### Chain Options

- `--chain 0` — all chains (default)
- `--chain 1` — Ethereum
- `--chain 56` — BSC
- `--chain 8453` — Base
- `--chain 42161` — Arbitrum
- `--chain 137` — Polygon

## Presenting Results

Present as a ranked list. For each token highlight:
- **Score breakdown** (liquidity, volume, vol/liq ratio, market cap, age, safety)
- **Token age** — fresh/early tokens with high scores are potential early opportunities
- **Gate results** if `--gates` was used

Ask the user which tokens they want to analyze further with the full pipeline (`/analyze`).
