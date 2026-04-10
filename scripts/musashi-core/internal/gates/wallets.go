package gates

import (
	"fmt"
	"strconv"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// WalletsGate implements Gate 3: Wallet Behavior.
// Uses DexScreener transaction data + GoPlus holder info with age-tiered thresholds.
// Analyzes buy diversity and volume trends, not just snapshots.
type WalletsGate struct {
	dex    *data.DexScreenerClient
}

func NewWalletsGate() *WalletsGate {
	return &WalletsGate{
		dex:    data.NewDexScreenerClient(),
	}
}

func (g *WalletsGate) Name() string { return "Wallet Behavior" }
func (g *WalletsGate) Number() int  { return 3 }

// walletThresholds returns tiered thresholds based on token age.
func walletThresholds(age TokenAge) (minHolders int, minTxns int, maxSellRatio float64) {
	switch age {
	case AgeFresh: // < 24h — early tokens naturally have fewer holders
		return 15, 5, 0.80
	case AgeEarly: // 1-7 days
		return 30, 10, 0.75
	default: // > 7 days — established
		return 50, 20, 0.70
	}
}

// Evaluate implements Gate interface (uses established thresholds as default).
func (g *WalletsGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

// EvaluateWithContext implements AgeAwareGate with tiered thresholds and trend analysis.
func (g *WalletsGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	minHolders, minTxns, maxSellRatio := walletThresholds(ctx.Age)

	if ctx.HasAgeData {
		result.AddEvidence("analysis", "token_age", string(ctx.Age))
		result.AddEvidence("analysis", "thresholds", fmt.Sprintf("min_holders=%d min_txns=%d max_sell_ratio=%.0f%% (tier: %s)", minHolders, minTxns, maxSellRatio*100, ctx.Age))
	}

	// GoPlus holder data (uses shared data from pipeline context)
	sec := ctx.GoPlusData
	if ctx.GoPlusFetched && ctx.GoPlusError != nil {
		result.AddEvidence("goplus", "error", ctx.GoPlusError.Error())
		return result.Warn("GoPlus does not support this chain — holder analysis skipped, agent should verify wallet behavior manually"), nil
	}
	if sec == nil {
		// Fallback: fetch directly if not cached (standalone gate execution)
		goplus := data.NewGoPlusClient()
		var err error
		sec, err = goplus.GetTokenSecurity(chainID, token)
		if err != nil {
			result.AddEvidence("goplus", "error", err.Error())
			return result.Warn("GoPlus does not support this chain — holder analysis skipped, agent should verify wallet behavior manually"), nil
		}
	}

	result.AddEvidence("goplus", "holder_count", sec.HolderCount)
	result.AddEvidence("goplus", "creator_address", sec.CreatorAddress)

	// Check 1: Minimum holders (tiered by age)
	holderCount, _ := strconv.Atoi(sec.HolderCount)
	if holderCount < minHolders {
		return result.Fail(fmt.Sprintf("Too few holders: %d (min %d for %s token)", holderCount, minHolders, ctx.Age)), nil
	}

	// DexScreener transaction data for buy/sell analysis
	dexData, err := g.dex.GetTokenPairs(token)
	if err != nil {
		return result.Fail(fmt.Sprintf("DexScreener API error: %v", err)), nil
	}

	if len(dexData.Pairs) == 0 {
		return result.Fail("No trading pairs found"), nil
	}

	// Aggregate buy/sell across all pairs at multiple timeframes
	var totalBuys24, totalSells24 int
	var totalBuys6h, totalSells6h int
	var totalBuys1h, totalSells1h int
	for _, p := range dexData.Pairs {
		totalBuys24 += p.Txns.H24.Buys
		totalSells24 += p.Txns.H24.Sells
		totalBuys6h += p.Txns.H6.Buys
		totalSells6h += p.Txns.H6.Sells
		totalBuys1h += p.Txns.H1.Buys
		totalSells1h += p.Txns.H1.Sells
	}

	result.AddEvidence("dexscreener", "buys_24h", fmt.Sprintf("%d", totalBuys24))
	result.AddEvidence("dexscreener", "sells_24h", fmt.Sprintf("%d", totalSells24))
	result.AddEvidence("dexscreener", "buys_6h", fmt.Sprintf("%d", totalBuys6h))
	result.AddEvidence("dexscreener", "sells_6h", fmt.Sprintf("%d", totalSells6h))
	result.AddEvidence("dexscreener", "buys_1h", fmt.Sprintf("%d", totalBuys1h))
	result.AddEvidence("dexscreener", "sells_1h", fmt.Sprintf("%d", totalSells1h))

	totalTxns24 := totalBuys24 + totalSells24
	if totalTxns24 == 0 {
		return result.Fail("No transactions in 24h — dead token"), nil
	}

	sellRatio24 := float64(totalSells24) / float64(totalTxns24)
	result.AddEvidence("analysis", "sell_ratio_24h", fmt.Sprintf("%.2f", sellRatio24))

	// Check 2: Sustained sell pressure (tiered)
	if sellRatio24 > maxSellRatio {
		return result.Fail(fmt.Sprintf("Heavy sell pressure: %.0f%% sells in 24h (max %.0f%% for %s token)", sellRatio24*100, maxSellRatio*100, ctx.Age)), nil
	}

	// Check 3: Transaction count sanity (tiered)
	if totalTxns24 < minTxns {
		// For fresh tokens, check if there's recent activity even if 24h total is low
		totalTxns1h := totalBuys1h + totalSells1h
		if ctx.Age == AgeFresh && totalTxns1h >= 3 {
			result.AddEvidence("analysis", "activity_context", fmt.Sprintf("24h txns %d is low but 1h has %d txns — token is actively trading", totalTxns24, totalTxns1h))
		} else {
			return result.Fail(fmt.Sprintf("Very low activity: only %d transactions in 24h (min %d for %s token)", totalTxns24, minTxns, ctx.Age)), nil
		}
	}

	// Check 4: Active dump detection (kept strict — dumps are always bad)
	totalTxns1h := totalBuys1h + totalSells1h
	if totalTxns1h > 10 {
		h1SellRatio := float64(totalSells1h) / float64(totalTxns1h)
		if h1SellRatio > 0.80 {
			return result.Fail(fmt.Sprintf("Active dump: %.0f%% sells in last hour", h1SellRatio*100)), nil
		}
	}

	// === NEW: Trend-Based Analysis ===

	// Buy diversity signal: compare transaction counts across timeframes
	// Many small buys across time = organic. Few large buys in one burst = whale/manipulation
	if totalTxns24 > 0 {
		buyRatio24 := float64(totalBuys24) / float64(totalTxns24)
		result.AddEvidence("analysis", "buy_ratio_24h", fmt.Sprintf("%.2f", buyRatio24))

		// Extremely buy-heavy with very few sellers can indicate manipulation (wash trading or coordinated pump)
		if buyRatio24 > 0.90 && totalBuys24 > 50 {
			result.AddEvidence("analysis", "buy_concentration_warning", "Over 90% buys — possible coordinated pump or wash trading")
		}
	}

	// Volume momentum: is activity growing or dying?
	// Compare 1h activity (annualized) vs 24h activity
	if totalTxns24 > 10 {
		recentActivity := float64(totalTxns1h) * 24
		activityTrend := recentActivity / float64(totalTxns24)
		result.AddEvidence("analysis", "activity_trend", fmt.Sprintf("%.2f", activityTrend))

		if activityTrend > 1.5 {
			result.AddEvidence("analysis", "activity_signal", "ACCELERATING — recent activity significantly above average")
		} else if activityTrend < 0.3 && ctx.Age != AgeFresh {
			result.AddEvidence("analysis", "activity_signal", "DECELERATING — recent activity significantly below average")
		}
	}

	// Buy/sell trend across timeframes: is buying pressure increasing or decreasing?
	totalTxns6h := totalBuys6h + totalSells6h
	if totalTxns6h > 5 && totalTxns24 > 10 {
		sellRatio6h := float64(totalSells6h) / float64(totalTxns6h)
		result.AddEvidence("analysis", "sell_ratio_6h", fmt.Sprintf("%.2f", sellRatio6h))

		// Sell pressure increasing over time = bearish trend
		if sellRatio6h > sellRatio24+0.15 {
			result.AddEvidence("analysis", "pressure_trend", "INCREASING SELLS — sell pressure rising in recent hours")
		}
		// Buy pressure increasing = accumulation
		if sellRatio6h < sellRatio24-0.15 {
			result.AddEvidence("analysis", "pressure_trend", "INCREASING BUYS — buy pressure rising in recent hours (accumulation signal)")
		}
	}

	return result.Pass(fmt.Sprintf("Wallet behavior is healthy (tier: %s, holders: %d, sell_ratio: %.0f%%)", ctx.Age, holderCount, sellRatio24*100)), nil
}
