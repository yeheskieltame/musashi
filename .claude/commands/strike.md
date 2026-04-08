# MUSASHI — Publish STRIKE

Publish a STRIKE conviction signal to 0G Chain (ConvictionLog).

**Arguments:** $ARGUMENTS

## Prerequisites

- `OG_CHAIN_PRIVATE_KEY` must be set
- `CONVICTION_LOG_ADDRESS` must be set
- Token must have passed the full analysis pipeline first

## Execution

Parse arguments for: token_address, convergence score, evidence hash, chain_id.

```bash
# Store evidence first
./scripts/musashi-core/musashi-core store '<evidence_json>'

# Publish STRIKE
./scripts/musashi-core/musashi-core strike <token_address> \
  --token-chain <chain_id> \
  --convergence <score> \
  --evidence <root_hash> \
  --agent-id 0
```

**MANDATORY:** Always confirm with the user before executing. This signs a transaction.

Report:
- Transaction hash + explorer link
- Convergence score
- Evidence root hash
- Download command for evidence verification
