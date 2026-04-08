package pipeline

import (
	"encoding/json"
	"fmt"
	"math"
	"sort"
	"strings"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/gates"
)

// ScanCandidate represents a scored token candidate.
type ScanCandidate struct {
	Address     string  `json:"address"`
	Name        string  `json:"name"`
	Symbol      string  `json:"symbol"`
	Chain       string  `json:"chain"`
	ChainID     int64   `json:"chain_id"`
	PriceUsd    string  `json:"price_usd"`
	MarketCap   float64 `json:"market_cap"`
	Liquidity   float64 `json:"liquidity_usd"`
	Volume24h   float64 `json:"volume_24h"`
	TokenAge    string  `json:"token_age"`
	AgeHours    float64 `json:"age_hours"`
	HolderCount string  `json:"holder_count,omitempty"`
	Score       float64 `json:"score"`
	ScoreBreak  string  `json:"score_breakdown"`
	SafetyCheck string  `json:"safety_check"`
	GateResult  string  `json:"gate_result,omitempty"`
	Source      string  `json:"source"`
}

// ScanResult is the output of a full scan.
type ScanResult struct {
	Timestamp  string          `json:"timestamp"`
	ChainID    int64           `json:"chain_id,omitempty"`
	TotalFound int             `json:"total_found"`
	Screened   int             `json:"screened"`
	TopPicks   []ScanCandidate `json:"top_picks"`
}

// ScanTokens fetches tokens from multiple sources, scores them, and returns
// ranked candidates. Optionally runs gates on the top N.
func ScanTokens(chainID int64, limit int, runGates bool) (string, error) {
	dex := data.NewDexScreenerClient()
	goplus := data.NewGoPlusClient()

	var rawCandidates []ScanCandidate
	seen := make(map[string]bool)

	// === Source 1: DexScreener boosted tokens (have direct token addresses) ===
	boosted, err := dex.GetBoostedTokens()
	if err == nil {
		for _, raw := range boosted {
			var bt struct {
				TokenAddress string `json:"tokenAddress"`
				ChainID      string `json:"chainId"`
				Description  string `json:"description"`
			}
			if json.Unmarshal(raw, &bt) == nil && bt.TokenAddress != "" {
				key := strings.ToLower(bt.TokenAddress + "_" + bt.ChainID)
				if !seen[key] {
					seen[key] = true
					cid := nameToChainID(bt.ChainID)
					if chainID > 0 && cid != chainID {
						continue
					}
					rawCandidates = append(rawCandidates, ScanCandidate{
						Address: bt.TokenAddress,
						Name:    bt.Description,
						Chain:   bt.ChainID,
						ChainID: cid,
						Source:  "boosted",
					})
				}
			}
		}
	}

	// === Source 2: CoinGecko trending → search on DexScreener ===
	cg := data.NewCoinGeckoClient()
	trending, err := cg.GetTrending()
	if err == nil {
		for _, coin := range trending.Coins {
			// Search each trending coin on DexScreener to get token addresses
			searchResult, err := dex.SearchTokens(coin.Item.Symbol)
			if err != nil || len(searchResult.Pairs) == 0 {
				continue
			}

			// Take the best pair per chain
			for _, p := range searchResult.Pairs {
				cid := nameToChainID(p.ChainID)
				if cid == 0 {
					continue // skip non-EVM
				}
				if chainID > 0 && cid != chainID {
					continue
				}
				key := strings.ToLower(p.BaseToken.Address + "_" + p.ChainID)
				if seen[key] {
					continue
				}
				seen[key] = true
				rawCandidates = append(rawCandidates, ScanCandidate{
					Address:   p.BaseToken.Address,
					Name:      p.BaseToken.Name,
					Symbol:    p.BaseToken.Symbol,
					Chain:     p.ChainID,
					ChainID:   cid,
					PriceUsd:  p.PriceUsd,
					MarketCap: p.MarketCap,
					Liquidity: p.Liquidity.Usd,
					Volume24h: p.Volume.H24,
					Source:    "trending",
				})
				break // one per trending coin is enough
			}
			time.Sleep(200 * time.Millisecond) // DexScreener rate limit
		}
	}

	// === Source 3: DexScreener search for popular meme terms ===
	memeTerms := []string{"pepe", "doge", "wojak", "chad", "based", "ai", "agent"}
	for _, term := range memeTerms {
		searchResult, err := dex.SearchTokens(term)
		if err != nil || len(searchResult.Pairs) == 0 {
			continue
		}

		for _, p := range searchResult.Pairs {
			cid := nameToChainID(p.ChainID)
			if cid == 0 {
				continue
			}
			if chainID > 0 && cid != chainID {
				continue
			}
			key := strings.ToLower(p.BaseToken.Address + "_" + p.ChainID)
			if seen[key] {
				continue
			}
			seen[key] = true

			rawCandidates = append(rawCandidates, ScanCandidate{
				Address:   p.BaseToken.Address,
				Name:      p.BaseToken.Name,
				Symbol:    p.BaseToken.Symbol,
				Chain:     p.ChainID,
				ChainID:   cid,
				PriceUsd:  p.PriceUsd,
				MarketCap: p.MarketCap,
				Liquidity: p.Liquidity.Usd,
				Volume24h: p.Volume.H24,
				Source:    "search:" + term,
			})
		}
		time.Sleep(300 * time.Millisecond)
	}

	totalFound := len(rawCandidates)

	// === Enrich candidates missing data + GoPlus safety check ===
	enriched := make([]ScanCandidate, 0)

	for i := range rawCandidates {
		c := &rawCandidates[i]

		// Skip non-EVM or invalid
		if c.ChainID == 0 || c.Address == "" {
			continue
		}

		// Enrich with DexScreener if we don't have data yet
		if c.Liquidity == 0 || c.MarketCap == 0 {
			dexData, err := dex.GetTokenPairs(c.Address)
			if err == nil && len(dexData.Pairs) > 0 {
				var bestPair *data.DexPair
				totalLiq := 0.0
				for j := range dexData.Pairs {
					p := &dexData.Pairs[j]
					totalLiq += p.Liquidity.Usd
					if bestPair == nil || p.Liquidity.Usd > bestPair.Liquidity.Usd {
						bestPair = p
					}
				}
				c.Name = bestPair.BaseToken.Name
				c.Symbol = bestPair.BaseToken.Symbol
				c.PriceUsd = bestPair.PriceUsd
				c.MarketCap = bestPair.MarketCap
				if c.MarketCap == 0 {
					c.MarketCap = bestPair.FDV
				}
				c.Liquidity = totalLiq
				c.Volume24h = bestPair.Volume.H24

				if bestPair.PairCreatedAt > 0 {
					ctx := gates.ClassifyAge(bestPair.PairCreatedAt)
					c.TokenAge = string(ctx.Age)
					c.AgeHours = ctx.AgeHours
				}
			} else {
				continue // can't get data, skip
			}
			time.Sleep(200 * time.Millisecond)
		} else {
			// We already have DexScreener data from search, just need age
			dexData, _ := dex.GetTokenPairs(c.Address)
			if dexData != nil && len(dexData.Pairs) > 0 {
				for _, p := range dexData.Pairs {
					if p.PairCreatedAt > 0 {
						ctx := gates.ClassifyAge(p.PairCreatedAt)
						c.TokenAge = string(ctx.Age)
						c.AgeHours = ctx.AgeHours
						break
					}
				}
			}
			time.Sleep(200 * time.Millisecond)
		}

		// Skip tokens with zero liquidity
		if c.Liquidity <= 0 {
			continue
		}

		// Quick GoPlus safety check
		sec, err := goplus.GetTokenSecurity(c.ChainID, c.Address)
		if err == nil {
			c.HolderCount = sec.HolderCount
			if sec.IsHoneypot == "1" {
				c.SafetyCheck = "FAIL:honeypot"
				continue
			}
			if sec.IsMintable == "1" {
				c.SafetyCheck = "FAIL:mintable"
				continue
			}
			if sec.CanTakeBackOwnership == "1" {
				c.SafetyCheck = "FAIL:owner_reclaim"
				continue
			}
			c.SafetyCheck = "OK"
		} else {
			c.SafetyCheck = "NO_DATA"
		}

		// Score the candidate
		c.Score, c.ScoreBreak = scoreCandidate(c)

		enriched = append(enriched, *c)
		time.Sleep(500 * time.Millisecond) // GoPlus rate limit buffer
	}

	// Sort by score descending
	sort.Slice(enriched, func(i, j int) bool {
		return enriched[i].Score > enriched[j].Score
	})

	// Take top N
	if len(enriched) > limit {
		enriched = enriched[:limit]
	}

	// Optionally run full gates on top picks
	if runGates && len(enriched) > 0 {
		gateLimit := 5
		if len(enriched) < gateLimit {
			gateLimit = len(enriched)
		}
		for i := 0; i < gateLimit; i++ {
			c := &enriched[i]
			result, err := RunGates(c.Address, c.ChainID)
			if err != nil {
				c.GateResult = fmt.Sprintf("ERROR: %v", err)
				continue
			}
			c.GateResult = result.Status
			if result.FailedAt > 0 {
				c.GateResult = fmt.Sprintf("FAIL@Gate%d", result.FailedAt)
			}
			time.Sleep(500 * time.Millisecond)
		}
	}

	scanResult := ScanResult{
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		ChainID:    chainID,
		TotalFound: totalFound,
		Screened:   len(enriched),
		TopPicks:   enriched,
	}

	b, _ := json.MarshalIndent(scanResult, "", "  ")
	return string(b), nil
}

// scoreCandidate assigns a composite score (0-100) based on multiple signals.
func scoreCandidate(c *ScanCandidate) (float64, string) {
	var score float64
	var parts []string

	// 1. Liquidity score (0-20): $5K=5, $50K=15, $500K+=20
	liqScore := math.Min(20, math.Log10(math.Max(c.Liquidity, 1))*5)
	score += liqScore
	parts = append(parts, fmt.Sprintf("liq=%.0f", liqScore))

	// 2. Volume score (0-20): active trading is good
	volScore := 0.0
	if c.Volume24h > 0 {
		volScore = math.Min(20, math.Log10(c.Volume24h)*4)
	}
	score += volScore
	parts = append(parts, fmt.Sprintf("vol=%.0f", volScore))

	// 3. Volume/Liquidity ratio (0-15): healthy trading relative to pool size
	vlRatio := 0.0
	if c.Liquidity > 0 {
		vlRatio = c.Volume24h / c.Liquidity
	}
	vlScore := 0.0
	if vlRatio > 0.1 && vlRatio < 5.0 {
		vlScore = math.Min(15, vlRatio*10)
	}
	score += vlScore
	parts = append(parts, fmt.Sprintf("v/l=%.0f", vlScore))

	// 4. Market cap sweet spot (0-20): $100K-$10M is ideal for early entry
	mcScore := 0.0
	if c.MarketCap > 0 {
		switch {
		case c.MarketCap >= 100000 && c.MarketCap < 1000000:
			mcScore = 20 // sweet spot: pre-discovery
		case c.MarketCap >= 1000000 && c.MarketCap < 5000000:
			mcScore = 18 // still early
		case c.MarketCap >= 5000000 && c.MarketCap < 10000000:
			mcScore = 12 // getting discovered
		case c.MarketCap >= 50000 && c.MarketCap < 100000:
			mcScore = 10 // very early, higher risk
		case c.MarketCap >= 10000000 && c.MarketCap < 50000000:
			mcScore = 8 // already known
		case c.MarketCap >= 50000000:
			mcScore = 3 // large cap, limited upside
		default:
			mcScore = 5
		}
	}
	score += mcScore
	parts = append(parts, fmt.Sprintf("mc=%.0f", mcScore))

	// 5. Token age bonus (0-15): fresh/early tokens get bonus
	ageScore := 0.0
	switch gates.TokenAge(c.TokenAge) {
	case gates.AgeFresh:
		ageScore = 15 // highest priority: fresh opportunities
	case gates.AgeEarly:
		ageScore = 12 // still early
	case gates.AgeEstablished:
		ageScore = 5 // established, less upside
	}
	score += ageScore
	parts = append(parts, fmt.Sprintf("age=%.0f", ageScore))

	// 6. Safety bonus (0-10)
	safetyScore := 0.0
	switch c.SafetyCheck {
	case "OK":
		safetyScore = 10
	case "NO_DATA":
		safetyScore = 3
	}
	score += safetyScore
	parts = append(parts, fmt.Sprintf("safe=%.0f", safetyScore))

	return score, strings.Join(parts, " ")
}

func chainIDToName(chainID int64) string {
	switch chainID {
	case 1:
		return "eth"
	case 56:
		return "bsc"
	case 137:
		return "polygon_pos"
	case 42161:
		return "arbitrum"
	case 8453:
		return "base"
	default:
		return "eth"
	}
}

func nameToChainID(name string) int64 {
	n := strings.ToLower(name)
	switch n {
	case "ethereum", "eth":
		return 1
	case "bsc", "bsc_mainnet":
		return 56
	case "polygon_pos", "polygon":
		return 137
	case "arbitrum":
		return 42161
	case "base":
		return 8453
	default:
		// Unknown or non-supported chain → skip (return 0)
		return 0
	}
}
