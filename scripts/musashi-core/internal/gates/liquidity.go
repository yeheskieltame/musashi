package gates

import (
	"fmt"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// LiquidityGate implements Gate 2: Liquidity Structure.
// Uses DexScreener + GeckoTerminal fallback + GoPlus LP data with age-tiered thresholds.
type LiquidityGate struct {
	dex    *data.DexScreenerClient
	gecko  *data.GeckoTerminalClient
	goplus *data.GoPlusClient
}

func NewLiquidityGate() *LiquidityGate {
	return &LiquidityGate{
		dex:    data.NewDexScreenerClient(),
		gecko:  data.NewGeckoTerminalClient(),
		goplus: data.NewGoPlusClient(),
	}
}

func (g *LiquidityGate) Name() string { return "Liquidity Structure" }
func (g *LiquidityGate) Number() int  { return 2 }

// liqThresholds returns tiered thresholds based on token age.
// Research-backed: $10K-$50K minimum for established, lower for fresh tokens
// because early-stage tokens naturally have less liquidity.
func liqThresholds(age TokenAge) (minLiquidity, minVolume float64, minLPRatio float64) {
	switch age {
	case AgeFresh: // < 24h — allow lower liquidity, focus on contract safety
		return 5000, 500, 0.03
	case AgeEarly: // 1-7 days — moderate thresholds
		return 8000, 800, 0.04
	default: // > 7 days — established thresholds
		return 10000, 1000, 0.05
	}
}

// Evaluate implements Gate interface (uses established thresholds as default).
func (g *LiquidityGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

// EvaluateWithContext implements AgeAwareGate with tiered thresholds.
func (g *LiquidityGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	minLiq, minVol, minRatio := liqThresholds(ctx.Age)

	if ctx.HasAgeData {
		result.AddEvidence("analysis", "token_age", string(ctx.Age))
		result.AddEvidence("analysis", "token_age_hours", fmt.Sprintf("%.1f", ctx.AgeHours))
		result.AddEvidence("analysis", "thresholds", fmt.Sprintf("min_liq=$%.0f min_vol=$%.0f min_ratio=%.0f%% (tier: %s)", minLiq, minVol, minRatio*100, ctx.Age))
	}

	// Fetch DexScreener data (primary)
	dexData, err := g.dex.GetTokenPairs(token)
	if err != nil || len(dexData.Pairs) == 0 {
		// Fallback to GeckoTerminal (supports chains DexScreener doesn't, e.g. 0G)
		network := data.ChainIDToNetwork(chainID)
		geckoToken, geckoErr := g.gecko.GetToken(network, token)
		if geckoErr != nil || geckoToken == nil {
			if err != nil {
				return result.Fail(fmt.Sprintf("DexScreener error: %v, GeckoTerminal fallback failed: %v", err, geckoErr)), nil
			}
			return result.Fail("No trading pairs found on DexScreener or GeckoTerminal"), nil
		}

		// Use GeckoTerminal data for liquidity assessment
		attr := geckoToken.Attributes
		result.AddEvidence("geckoterminal", "source", "fallback (DexScreener unavailable for this chain)")
		result.AddEvidence("geckoterminal", "token_name", attr.Name)
		result.AddEvidence("geckoterminal", "token_symbol", attr.Symbol)
		result.AddEvidence("geckoterminal", "price_usd", attr.PriceUsd)
		result.AddEvidence("geckoterminal", "fdv_usd", attr.FDVUsd)
		result.AddEvidence("geckoterminal", "volume_24h", attr.Volume24h)
		result.AddEvidence("geckoterminal", "market_cap_usd", attr.MarketCapUsd)

		// Get pool data for liquidity and volume
		pools, poolErr := g.gecko.GetTokenPools(network, token)
		totalLiquidity := 0.0
		totalVolume := 0.0
		if poolErr == nil {
			for _, p := range pools {
				var reserve, vol float64
				fmt.Sscanf(p.Attributes.ReserveUsd, "%f", &reserve)
				fmt.Sscanf(p.Attributes.GetVolumeH24(), "%f", &vol)
				totalLiquidity += reserve
				totalVolume += vol
			}
			result.AddEvidence("geckoterminal", "pool_count", fmt.Sprintf("%d", len(pools)))
			result.AddEvidence("geckoterminal", "total_liquidity_usd", fmt.Sprintf("%.2f", totalLiquidity))
			result.AddEvidence("geckoterminal", "total_volume_24h_usd", fmt.Sprintf("%.2f", totalVolume))
		}

		if totalLiquidity < minLiq {
			return result.Fail(fmt.Sprintf("Total liquidity too low: $%.0f (min $%.0f for %s token) [via GeckoTerminal]", totalLiquidity, minLiq, ctx.Age)), nil
		}

		// Use pool-aggregated volume (more reliable than token-level for some chains)
		vol24h := totalVolume
		if vol24h == 0 && attr.Volume24h != "" {
			fmt.Sscanf(attr.Volume24h, "%f", &vol24h)
		}
		if vol24h < minVol {
			return result.Fail(fmt.Sprintf("24h volume too low: $%.0f (min $%.0f for %s token) [via GeckoTerminal]", vol24h, minVol, ctx.Age)), nil
		}

		return result.Pass(fmt.Sprintf("Liquidity structure healthy via GeckoTerminal (tier: %s, chain: %s)", ctx.Age, network)), nil
	}

	// Use the highest-liquidity pair as primary
	var bestPair *data.DexPair
	for i := range dexData.Pairs {
		if bestPair == nil || dexData.Pairs[i].Liquidity.Usd > bestPair.Liquidity.Usd {
			bestPair = &dexData.Pairs[i]
		}
	}

	totalLiquidity := 0.0
	for _, p := range dexData.Pairs {
		totalLiquidity += p.Liquidity.Usd
	}

	result.AddEvidence("dexscreener", "total_liquidity_usd", fmt.Sprintf("%.2f", totalLiquidity))
	result.AddEvidence("dexscreener", "best_pair_dex", bestPair.DexID)
	result.AddEvidence("dexscreener", "best_pair_liquidity", fmt.Sprintf("%.2f", bestPair.Liquidity.Usd))
	result.AddEvidence("dexscreener", "pair_count", fmt.Sprintf("%d", len(dexData.Pairs)))
	result.AddEvidence("dexscreener", "fdv", fmt.Sprintf("%.2f", bestPair.FDV))
	result.AddEvidence("dexscreener", "market_cap", fmt.Sprintf("%.2f", bestPair.MarketCap))
	result.AddEvidence("dexscreener", "price_usd", bestPair.PriceUsd)
	result.AddEvidence("dexscreener", "volume_24h", fmt.Sprintf("%.2f", bestPair.Volume.H24))

	// Check 1: Minimum liquidity (tiered by age)
	if totalLiquidity < minLiq {
		return result.Fail(fmt.Sprintf("Total liquidity too low: $%.0f (min $%.0f for %s token)", totalLiquidity, minLiq, ctx.Age)), nil
	}

	// Check 2: LP depth vs market cap (tiered ratio)
	if bestPair.MarketCap > 0 {
		lpRatio := totalLiquidity / bestPair.MarketCap
		result.AddEvidence("dexscreener", "lp_to_mcap_ratio", fmt.Sprintf("%.4f", lpRatio))

		if lpRatio < minRatio {
			if totalLiquidity >= 1000000 {
				result.AddEvidence("analysis", "lp_context", fmt.Sprintf("LP ratio %.1f%% is low but absolute liquidity $%.0fM is substantial — likely CEX-listed token", lpRatio*100, totalLiquidity/1000000))
			} else {
				return result.Fail(fmt.Sprintf("LP depth too thin: %.1f%% of market cap (min %.0f%% for %s token)", lpRatio*100, minRatio*100, ctx.Age)), nil
			}
		}
	}

	// Check 3: Liquidity concentration
	if totalLiquidity > 0 && bestPair.Liquidity.Usd/totalLiquidity > 0.95 && len(dexData.Pairs) > 1 {
		result.AddEvidence("analysis", "liquidity_concentration", fmt.Sprintf("%.1f%% on %s", bestPair.Liquidity.Usd/totalLiquidity*100, bestPair.DexID))
	}

	// Check 4: GoPlus LP lock status
	sec, err := g.goplus.GetTokenSecurity(chainID, token)
	if err == nil && len(sec.LPHolders) > 0 {
		totalLPLocked := 0
		for _, lp := range sec.LPHolders {
			if lp.IsLocked == 1 {
				totalLPLocked++
			}
		}
		result.AddEvidence("goplus", "lp_holders", fmt.Sprintf("%d", len(sec.LPHolders)))
		result.AddEvidence("goplus", "lp_locked_count", fmt.Sprintf("%d", totalLPLocked))

		if totalLPLocked == 0 && len(sec.LPHolders) > 0 {
			// For fresh tokens, LP not locked yet is a WARNING, not instant fail
			// Many legit tokens lock LP within first few hours
			if ctx.Age == AgeFresh {
				result.AddEvidence("analysis", "lp_lock_context", "LP not locked — acceptable for <24h token but flag for monitoring")
			} else {
				return result.Fail("No LP is locked — rug pull risk"), nil
			}
		}
	}

	// Check 5: Volume sanity (tiered by age)
	if bestPair.Volume.H24 < minVol {
		// For fresh tokens, check if volume is growing (h1 > 0 indicates life)
		if ctx.Age == AgeFresh && bestPair.Volume.H1 > 0 {
			result.AddEvidence("analysis", "volume_context", fmt.Sprintf("24h volume $%.0f is low but 1h volume $%.0f shows active trading — acceptable for fresh token", bestPair.Volume.H24, bestPair.Volume.H1))
		} else {
			return result.Fail(fmt.Sprintf("24h volume too low: $%.0f (min $%.0f for %s token)", bestPair.Volume.H24, minVol, ctx.Age)), nil
		}
	}

	// Bonus: Volume trend analysis (new)
	// Rising volume from low base = accumulation signal
	if bestPair.Volume.H1 > 0 && bestPair.Volume.H24 > 0 {
		h1Annualized := bestPair.Volume.H1 * 24
		volumeAcceleration := h1Annualized / bestPair.Volume.H24
		if volumeAcceleration > 1.5 {
			result.AddEvidence("analysis", "volume_acceleration", fmt.Sprintf("%.1fx — volume is accelerating (1h*24 vs 24h)", volumeAcceleration))
		}
	}

	passMsg := fmt.Sprintf("Liquidity structure is healthy (tier: %s)", ctx.Age)
	if ctx.Age == AgeFresh {
		// sec may be nil if GoPlus call failed above — only check LP lock if we have data
		if sec != nil && len(sec.LPHolders) > 0 {
			lpLocked := 0
			for _, lp := range sec.LPHolders {
				if lp.IsLocked == 1 {
					lpLocked++
				}
			}
			if lpLocked == 0 {
				return result.Warn("Liquidity acceptable for fresh token but LP not locked — monitor closely"), nil
			}
		} else {
			return result.Warn("Liquidity acceptable for fresh token but LP lock status unknown — monitor closely"), nil
		}
	}
	return result.Pass(passMsg), nil
}
