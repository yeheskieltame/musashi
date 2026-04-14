---
model: claude-sonnet-4-6
description: Query MUSASHI's learning journal — past pipeline runs, cache hits, trap history
---

# MUSASHI — Journal Inspector

Query MUSASHI's learning layer: every past `/analyze` or `/hunt` run is journaled, regardless of verdict. The journal is the agent's memory beyond the on-chain strike log.

**Arguments:** $ARGUMENTS

## What's in the journal

The journal is `~/.musashi/journal.jsonl` — one line per past pipeline run. Each line records:
- Token + chain + timestamp
- Verdict (PASS / STRIKE_WATCH / FAIL / WARN / NEED_MORE_DATA)
- Convergence score, pattern match, failed gate
- Reason (one-line judge rationale)
- 0G Storage merkle root (if full payload was uploaded)

**Journal captures EVERYTHING**, not just strikes. FAILs teach traps, STRIKE_WATCHes teach calibration, PASSes build reputation.

## Modes

### Query by token
```bash
./scripts/musashi-core/musashi-core journal list --token <address> [--chain <id>] [--limit 10]
```
Show every past analysis for a specific token.

### Query by verdict kind
```bash
./scripts/musashi-core/musashi-core journal list --kind FAIL [--limit 20]
./scripts/musashi-core/musashi-core journal list --kind STRIKE_WATCH [--limit 20]
./scripts/musashi-core/musashi-core journal list --kind PASS [--limit 20]
```
Show recent failures (trap corpus), watchlist (near-misses to check on), or strikes.

### Recent activity
```bash
./scripts/musashi-core/musashi-core journal list --limit 20
```
Show last 20 entries across all verdicts.

### Check cache for a token (is it worth re-analyzing?)
```bash
./scripts/musashi-core/musashi-core journal check <address> --chain <id> --age <fresh|early|established>
```
Exit 0 = recent analysis exists (within freshness window). Exit 3 = no hit.

### Fetch full payload (gates + specialists + debate + judge reasoning)
```bash
./scripts/musashi-core/musashi-core journal fetch <storage_root> --out /tmp/payload.json
```
Downloads the full archived analysis from 0G Storage. Local journal index only has summary fields.

## How you present results to the user

1. **Parse the JSON output** from the `journal list` or `journal check` command.
2. **Summarize in plain language**:
   - "You analyzed [TOKEN] 3 times: [date] FAIL (sniper cluster), [date] STRIKE_WATCH (holder growth uncertain), [date] PASS (convergence 4/4, +12% realized)."
   - "Last 10 failures: 4× Manufactured Hype, 3× Dev Distribution, 2× Narrative Exhaustion, 1× Sniper Coalition."
3. **Highlight patterns** — if 3+ similar failures in the last week, flag the repeated trap.
4. **Suggest followups** — if an old STRIKE_WATCH is still open, ask the user if they want to run `/analyze` again to see if conditions flipped.

## When to use `/journal`

- User asks "have I analyzed [TOKEN] before?"
- User asks "what traps have I been catching lately?"
- User asks "why did I skip [TOKEN] last time?"
- User wants to audit MUSASHI's reasoning history
- Before publishing a STRIKE manually — sanity check the token's journal history

## Freshness windows (for `journal check`)

| Token age | Window |
|---|---|
| fresh (<24h) | 2h |
| early (1–7d) | 6h |
| established (>7d) | 24h |

A token outside its freshness window will be treated as cache miss — re-analysis is warranted because conditions change fast in memecoins.
