# MUSASHI — Status Check

Check MUSASHI's on-chain state: conviction record, reputation, and agent info.

**Arguments:** $ARGUMENTS

## Execution

Run both commands:

```bash
# ConvictionLog state (strike count + reputation)
./scripts/musashi-core/musashi-core status

# Agent INFT state
./scripts/musashi-core/musashi-core agent-info --token-id 0
```

Present a summary:
- Total STRIKEs published
- Win/Loss record
- Win rate percentage
- Total return (bps)
- Agent INFT status (active, convergence avg, intelligence hash)
- Last updated timestamp
