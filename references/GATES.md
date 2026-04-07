# Gate Reference — Detailed Criteria & Thresholds

## Token Age Tiers

MUSASHI uses **age-tiered thresholds** for Gates 2 and 3. Token age is automatically detected from DexScreener's `pairCreatedAt` timestamp.

| Tier | Age | Philosophy |
|------|-----|-----------|
| **Fresh** | < 24 hours | Lower data thresholds — focus on contract safety + deployer quality |
| **Early** | 1-7 days | Moderate thresholds — growing metrics matter more than absolutes |
| **Established** | > 7 days | Full thresholds — if metrics are still weak after a week, token is struggling |

Gate 1 (Contract Safety) remains **strict regardless of age** — honeypots, mintable supply, and rug vectors are always instant kills.

## Gate 1: Contract Safety

**Source:** GoPlus Security API + Chain RPC
**Behavior:** Instant kill on any critical finding. **No age exceptions.**

| Check | Threshold | Source Field | Action |
|-------|-----------|-------------|--------|
| Honeypot | `is_honeypot == "1"` | GoPlus | INSTANT FAIL |
| Mintable | `is_mintable == "1"` | GoPlus | FAIL |
| Ownership takeback | `can_take_back_ownership == "1"` | GoPlus | FAIL |
| Blacklist | `is_blacklisted == "1"` | GoPlus | Context-dependent |
| Slippage modifiable | `slippage_modifiable == "1"` | GoPlus | Context-dependent |
| Transfer pausable | `transfer_pausable == "1"` | GoPlus | Context-dependent |
| Sell tax > 5% | `sell_tax > 0.05` | GoPlus | FAIL |
| Tax asymmetry | `sell_tax > buy_tax + 0.03` | GoPlus | FAIL |
| Closed-source proxy | `is_proxy == "1" && is_open_source != "1"` | GoPlus | FAIL |
| Multiple warnings | `>= 2` warning flags | GoPlus | FAIL |
| Single warning + low holders | `< 10,000` holders with warning | GoPlus | FAIL |

## Gate 2: Liquidity Structure

**Source:** DexScreener + GoPlus LP data
**Behavior:** Sequential checks with age-tiered thresholds

### Tiered Thresholds

| Check | Fresh (<24h) | Early (1-7d) | Established (>7d) |
|-------|-------------|-------------|-------------------|
| Min liquidity | $5,000 | $8,000 | $10,000 |
| Min 24h volume | $500 | $800 | $1,000 |
| Min LP/mcap ratio | 3% | 4% | 5% |

### Fixed Checks (All Tiers)

| Check | Threshold | Action |
|-------|-----------|--------|
| No pairs found | `len(pairs) == 0` | FAIL |
| LP/mcap exception | `totalLiq >= $1M` | Skip ratio check (likely CEX-listed) |
| No LP locked (fresh) | `locked_count == 0` | WARN (monitor, not instant fail) |
| No LP locked (early/est.) | `locked_count == 0` | FAIL |
| Volume acceleration | `h1*24 / h24 > 1.5` | Logged as positive signal |
| Fresh token + h1 volume > 0 | Despite low 24h volume | Pass with context (actively trading) |

## Gate 3: Wallet Behavior

**Source:** GoPlus holder data + DexScreener transactions
**Behavior:** Age-tiered thresholds + trend analysis (not just snapshots)

### Tiered Thresholds

| Check | Fresh (<24h) | Early (1-7d) | Established (>7d) |
|-------|-------------|-------------|-------------------|
| Min holders | 15 | 30 | 50 |
| Min 24h txns | 5 | 10 | 20 |
| Max sell ratio (24h) | 80% | 75% | 70% |

### Fixed Checks (All Tiers)

| Check | Threshold | Action |
|-------|-----------|--------|
| No 24h transactions | `buys + sells == 0` | FAIL |
| Hourly dump | `1h sells / total > 80% (when txns > 10)` | FAIL |
| Buy concentration | `> 90% buys with > 50 txns` | WARNING logged (possible wash trading) |

### Trend Analysis (NEW)

| Signal | Calculation | Meaning |
|--------|------------|---------|
| Activity trend | `(1h_txns * 24) / 24h_txns` | >1.5 = accelerating, <0.3 = decelerating |
| Pressure trend | `sell_ratio_6h vs sell_ratio_24h` | >+15% = increasing sells, <-15% = increasing buys |
| Buy diversity | Transaction size distribution | Many small buys = organic, few large = whale |
| Fresh token context | `1h txns >= 3` despite low 24h | Acceptable for <24h tokens |

## Gate 4: Social Momentum (Agent-Driven)

**Source:** Agent browsing X/Twitter, Farcaster
**Behavior:** Agent investigates and assesses

| Signal | Assessment | Action |
|--------|-----------|--------|
| Bot activity | `> 60%` bot-like posts | FAIL |
| No discussion | Zero genuine posts found | FAIL |
| Shill-only | All posts are paid promotion | FAIL |
| Organic growth | Genuine community discussion | PASS |
| Influencer quality | Known, reputable voices | BONUS |
| Community authenticity | 3-5% engagement ratio, 20-30% DAU | Scored in specialist |
| Meme penetration | Alpha-only / CT / Mainstream | Earlier = better entry |

## Gate 5: Narrative Alignment (Agent-Driven)

**Source:** Agent web search and research
**Behavior:** Agent evaluates narrative fit and lifecycle stage

| Signal | Assessment | Action |
|--------|-----------|--------|
| Dead narrative | Narrative has peaked and declining | FAIL |
| No narrative | Token doesn't fit any current meta | FAIL |
| Latecomer | >20 competitors already established | FAIL |
| Growing narrative | Narrative gaining momentum | PASS |
| **Forming narrative** | **First/second in emerging narrative** | **STRONG PASS (early signal)** |
| Copycat detection | >5 similar tokens = narrative peaking | WARNING |
| Mainstream coverage | YouTube/TikTok = late entry | WARNING |

## Gate 6: Market Timing

**Source:** CoinGecko global + DefiLlama TVL/stablecoins
**Behavior:** Assess macro conditions + token lifecycle

| Check | Threshold | Action |
|-------|-----------|--------|
| Market freefall | `24h change < -8%` | FAIL |
| Chain TVL decline (7d) | `> -15%` | FAIL |
| Chain TVL decline (30d) | `> -30%` | FAIL |
| BTC dominance | `> 65%` | WARNING |
| Multiple warnings | `>= 2 warnings` | WARN status |

### Entry Timing Assessment (NEW)

| Signal | Interpretation |
|--------|---------------|
| Market cap $100K-$10M | Sweet spot for early entry |
| Market cap < $100K | Extreme risk |
| Market cap > $10M | Already discovered, limited upside |
| Rising volume + flat price | Accumulation (BULLISH entry) |
| Rising price + declining volume | Distribution (BEARISH — late) |

## Gate 7: Cross-Validation

**Source:** DexScreener vs GeckoTerminal comparison
**Behavior:** Verify data consistency across sources

| Check | Threshold | Action |
|-------|-----------|--------|
| Both sources fail | Cannot fetch from either | FAIL |
| Price divergence | `> 10%` between sources | FAIL |
| Volume divergence | `> 50%` between sources | FAIL |
| One source unavailable | Single source only | WARN |
| Moderate price gap | `5-10%` divergence | WARNING logged |
