# Gate Reference

## Philosophy

MUSASHI hunts memecoins/narrative tokens early. Rules:

1. **Gate 1 (Contract Safety) is the ONLY hard rug-filter.** Honeypot, mint, ownership-takeback, fake-source = instant kill. No age exceptions.
2. **Gates 2–3 use velocity, not snapshots.** A 2-hour-old token with 12 holders that's adding 3/hour beats a week-old token with 500 flat holders.
3. **Gate 6 (Market Timing) is ADVISORY, never a veto.** Macro adjusts entry sizing and conviction language, but it NEVER fails a strike. Memecoins rotate independently of BTC — real hunters buy narrative rotations while macro is red.
4. **Fresh token data thinness is a FEATURE.** Absence of CoinGecko/social data on <24h token = you're early, not blind.

## Token Age Tiers

Auto-detected from DexScreener `pairCreatedAt`.

| Tier | Age | Decisive fields |
|---|---|---|
| Fresh | <24h | `is_honeypot`, `is_mintable`, `can_take_back_ownership`, `source_verified` only. Everything else = velocity-based. |
| Early | 1–7d | + deployer history + LP lock status |
| Established | >7d | + full snapshot thresholds |

## Gate 1 — Contract Safety (STRICT, all ages)

Source: GoPlus + RPC. Any instant-kill = FAIL.

| Check | Threshold | Action |
|---|---|---|
| Honeypot | `is_honeypot=1` | INSTANT FAIL |
| Mintable | `is_mintable=1` | FAIL |
| Ownership takeback | `can_take_back_ownership=1` | FAIL |
| Sell tax > 5% | `sell_tax>0.05` | FAIL |
| Tax asymmetry | `sell_tax > buy_tax+0.03` | FAIL |
| Transfer pausable | `transfer_pausable=1` | FAIL |
| Slippage modifiable | `slippage_modifiable=1` | FAIL |
| Closed-source proxy | `is_proxy=1 && !is_open_source` | FAIL |
| Blacklist function | `is_blacklisted=1` | FAIL |

## Gate 2 — Liquidity Structure

Age-tiered minimums. Fresh tokens get VELOCITY credit.

| Check | Fresh | Early | Established |
|---|---|---|---|
| Min liquidity | $3k | $8k | $10k |
| Min 24h volume | $200 | $800 | $1k |
| Min LP/mcap | 2% | 4% | 5% |

### Velocity overrides (fresh tokens only)

A fresh token below absolute thresholds PASSES if:
- `h1_volume > 0` AND `h1_txns ≥ 3` (actively trading now)
- `h1*24 / h24 ≥ 1.5` (volume accelerating)
- LP is growing (additions > withdrawals in last 6h)

### LP lock rules

| Situation | Action |
|---|---|
| Fresh + unlocked + organic buys | **WATCH** (pure retail conviction, normal for memecoins) |
| Fresh + unlocked + single-wallet volume | FAIL (dev loading fake volume) |
| Early/Established + unlocked | FAIL |
| Lock expires <48h | FAIL (dev prepping exit) |
| LP held by known locker (Unicrypt/PinkLock/TeamFinance/Mudra) | PASS |
| LP held by EOA | RUG VECTOR |

## Gate 3 — Wallet Behavior

Velocity-first. Snapshot-only checks for established tokens.

| Check | Fresh | Early | Established |
|---|---|---|---|
| Min holders | 8 | 30 | 50 |
| Min 24h txns | 3 | 10 | 20 |
| Max sell ratio 24h | 85% | 75% | 70% |

### Velocity signals (primary for fresh/early)

| Signal | Calc | Read |
|---|---|---|
| Activity trend | `(h1_txns * 24) / h24_txns` | >1.5 accelerating, <0.3 fading |
| Holder growth rate | new_holders / hour | >3/hr fresh = organic |
| Unique buyer velocity | distinct new wallets / hour | >5/hr = broad interest |
| Pressure trend | `sell_ratio_6h − sell_ratio_24h` | <−15% buy pressure building |
| Buy diversity | small many vs few large | many small = organic |

### Hunter red flags (any = FAIL)

- **Sniper cluster:** 3+ top holders bought in same block as LP add
- **Bundle wash:** identical buy amounts, sequential nonces, same funding source
- **Dev distribution phase:** deployer wallet selling while social pumps
- **Hourly dump:** `h1_sells/total > 80%` with txns > 10
- **Single-whale thesis:** one wallet >30% supply (excluding burn)

## Gate 4 — Social Momentum (agent-driven)

Agent investigates. Low social on fresh token ≠ fail — it's the signal.

| Signal | Read |
|---|---|
| Bot-dominated (>60% copy-paste) | FAIL |
| Shill-only paid promotion | FAIL |
| Zero signal after full search (1–10 in narrative_specialist) | NEUTRAL, not fail |
| Alpha-channel seeding (Discord/TG, pre-CT) | STRONG PASS — earliest stage |
| Organic CT small-acct discussion | PASS |
| Mainstream CT / YouTube / TikTok | WARN (late) |

## Gate 5 — Narrative Alignment (agent-driven)

| Signal | Read |
|---|---|
| First/second mover in FORMING narrative | STRONG PASS |
| Dead/exhausted narrative (>20 copycats, peaked >7d) | FAIL |
| Growing narrative, 5–20 competitors | PASS |
| Copycat-tail in Peak narrative | WARN |
| No narrative fit | NEUTRAL (judge on fundamentals) |

## Gate 6 — Market Timing (ADVISORY ONLY — never fails strikes)

Source: CoinGecko + DefiLlama. Output: `entry_timing: GREEN/YELLOW/RED` + `narrative_rotation_score`.

| Signal | Interpretation |
|---|---|
| BTC dominance rising | Alts bleeding vs BTC. Narrow hunt to strongest narrative rotations. NOT a fail. |
| Chain TVL declining | Risk-off sentiment. Size entries smaller, not zero. NOT a fail. |
| Total mcap -8% 24h | Buyer's market. Memecoin narrative rotations INTENSIFY during these phases. ADVISORY. |
| Stablecoins flowing to chain | GREEN — capital is here |
| Meme/narrative sector +X% while BTC -Y% | **HIGHEST CONVICTION** — active rotation, hunt the leaders |

**Hard rule: Gate 6 NEVER returns FAIL.** It returns ADVISORY with `entry_timing` and a `rotation_note`. The judge uses this for sizing language, not pass/fail.

## Gate 7 — Cross-Validation

| Check | Threshold | Action |
|---|---|---|
| Both DexScreener + GeckoTerminal unreachable | — | FAIL |
| Price divergence > 15% | — | FAIL |
| Volume divergence > 100% | — | WARN |
| One source only | — | WARN (not fail) |
