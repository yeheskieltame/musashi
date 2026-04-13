# MUSASHI — Hunt Strikes (just tell me what to strike)

When the user says _"what should I strike?"_, _"find me something"_, _"give me a recommendation"_, or _"I don't know what to analyze"_, this is the command. It runs the end-to-end funnel and returns a ranked list of candidates with gate verdicts — no manual token input required.

**Arguments:** $ARGUMENTS

## Execution

Parse the arguments for chain (default: Base). Default top = 3.

```bash
./scripts/musashi-core/musashi-core hunt --chain <chain_id> --top 3 --output json
```

Chain options: `1` ETH · `56` BSC · `137` Polygon · `42161` Arbitrum · `8453` Base (default) · `16661` 0G

### What hunt does internally (rate-limit safe)

1. **Gather** — 4 parallel list calls: GeckoTerminal trending_pools + new_pools, DexScreener boosts, CoinGecko categories. Embedded volume/reserve/price-change data, zero per-token calls.
2. **Score** — pure heuristic on embedded data: liquidity floor, volume tier, buy pressure, price momentum, narrative match (from top-rising CoinGecko categories), multi-source convergence bonus, boost-without-backing penalty.
3. **Deep gates** — full automated pipeline (gates 1,2,3,6,7) on the top N survivors only. Fail-fast, so honeypots drop out cheaply.

Output is JSON with ranked candidates, each carrying score breakdown and gate verdict.

## What you do after hunt returns

1. **Read the hunt output.** Look at candidates sorted by score.
2. **Filter by gate verdict.**
   - `PASS` or `WARN` candidates → worth running specialists + debate on
   - `FAIL` → mention as traps found, explain why (from gate reason)
   - `DATA_INSUFFICIENT` → the agent must fill gaps; treat as "needs investigation" not failure
3. **Run specialists on survivors only.** For each PASS/WARN candidate, load the four specialist prompts (safety, onchain, narrative, market) and run them against the gate evidence. This is where the LLM token budget goes — only on the already-ranked survivors, never on the full gathered set.
4. **Pattern detection + adversarial debate** on the survivors (musashi_pattern.md, bull_researcher.md, bear_researcher.md) same as `/analyze`.
5. **Judge verdict.** conviction_judge.md decides PASS/FAIL per candidate.
6. **Recommend.** Present 1-3 ranked recommendations with:
   - Symbol + address + chain
   - Score + why it ranked high (narrative hit? momentum? convergence?)
   - Gate outcome
   - Specialist consensus
   - Judge verdict (STRIKE / WATCHLIST / SKIP)
   - If STRIKE: offer to publish on-chain via `/strike`

## Important

- **Never run specialists on the full gathered set.** That defeats the whole point — the funnel is designed to keep LLM token cost bounded regardless of how many candidates came in.
- **Respect the hunt ranking.** The heuristic is data-backed; don't second-guess its ordering unless you have a specific reason.
- **If hunt returns zero survivors:** report honestly. Sometimes the market is quiet — no strikes today is a valid verdict.
- **If the user wants a specific token instead,** redirect to `/analyze <token>`.

## Example output format to the user

```
武蔵 MUSASHI Hunt — Base — 3 candidates qualified

#1 $RAVE — RaveDAO  score 33.0  Narrative: Music rotation
   Volume $3.9M / Liq $477k · +218% 24h · trending_pools
   Gates:    FAIL — LP depth 0.0% (min 5%)
   Verdict:  TRAP — skip

#2 $XYZ — Example Token  score 28.5  Narrative: AI Agents
   Volume $1.2M / Liq $890k · +47% 24h · trending + boost
   Gates:    PASS all 5 automated
   Specialists: safety ok, onchain ok, narrative strong, market bullish
   Convergence: 4/4
   Judge:    STRIKE — early adopter zone, fundamentals confirmed
   → want me to publish this to 0G Chain?

#3 ...
```

Keep it terse. The user asked "what should I strike" — give them a decision, not a research paper.
