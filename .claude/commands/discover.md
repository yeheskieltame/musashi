---
model: claude-sonnet-4-6
description: Raw token discovery with pre-screening
---

# MUSASHI — Raw Token Discovery

Discover newly created tokens with pre-screening (honeypot/mint/ownership filtered out).

**Arguments:** $ARGUMENTS

## Execution

```bash
./scripts/musashi-core/musashi-core discover --chain <chain_id> --limit <n>
```

Default: `--chain 1 --limit 20`

Parse arguments for chain preference (eth, bsc, base, arbitrum, polygon, all).

## Presenting Results

For each discovered token show:
- Name, symbol, address
- Token age, deployer address
- Holder count, safety verdict
- Source (GeckoTerminal new pools, trending, DexScreener boosted)

Suggest running `/scan` for scored ranking or `/analyze` for full pipeline on specific tokens.
