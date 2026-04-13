package pipeline

import (
	"encoding/json"
	"fmt"
	"strings"
	"sync"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// HuntResult is the "just tell me what to strike" output.
// User asks "what should I strike?" → hunt returns ranked candidates
// with embedded gate verdicts. Agent can optionally run debate on top N.
type HuntResult struct {
	ChainID     int64           `json:"chain_id"`
	Timestamp   string          `json:"timestamp"`
	Gathered    int             `json:"gathered"`
	Scored      int             `json:"scored"`
	GatesRan    int             `json:"gates_ran"`
	TopNarratives []string      `json:"top_narratives,omitempty"`
	Candidates  []HuntCandidate `json:"candidates"`
	Notes       []string        `json:"notes,omitempty"`
}

// HuntCandidate represents one ranked candidate at any stage of the funnel.
type HuntCandidate struct {
	Address        string   `json:"address"`
	Symbol         string   `json:"symbol,omitempty"`
	Name           string   `json:"name,omitempty"`
	PoolAddress    string   `json:"pool_address,omitempty"`
	Sources        []string `json:"sources"` // which list calls surfaced this token
	ReserveUsd     float64  `json:"reserve_usd"`
	Volume24h      float64  `json:"volume_24h"`
	PriceChange24h float64  `json:"price_change_24h"`
	PriceChange1h  float64  `json:"price_change_1h"`
	Buys24h        int      `json:"buys_24h"`
	Sells24h       int      `json:"sells_24h"`
	PoolCreatedAt  string   `json:"pool_created_at,omitempty"`
	Boosted        bool     `json:"boosted"`
	NarrativeHit   string   `json:"narrative_hit,omitempty"`
	Score          float64  `json:"score"`
	ScoreBreakdown string   `json:"score_breakdown,omitempty"`

	// Populated in stage 4 (deep gate check) for the top N.
	GateVerdict string          `json:"gate_verdict,omitempty"`
	GateReason  string          `json:"gate_reason,omitempty"`
	GateResult  *PipelineResult `json:"gate_result,omitempty"`
}

// HuntStrikes executes the full funnel: list-only gather → heuristic scoring
// → deep gate check on top N. Designed to fit free-tier rate limits across
// all providers.
//
// Rate-limit budget (per hunt):
//   - Stage 1 (gather):    5 list calls (CoinGecko×1, DexScreener×1, GeckoTerminal×2-3)
//   - Stage 2 (scoring):   0 calls (pure compute on embedded data)
//   - Stage 3 (gates top N): ~5-10 calls per token × N (RunGates is fail-fast)
//
// Total for topN=3: ~25 calls spread across ~3 min. Safe for all free providers.
func HuntStrikes(chainID int64, topN int) (*HuntResult, error) {
	if topN <= 0 {
		topN = 3
	}

	result := &HuntResult{
		ChainID:    chainID,
		Timestamp:  time.Now().UTC().Format(time.RFC3339),
		Candidates: []HuntCandidate{},
	}

	// ── Stage 1: gather from list endpoints in parallel ──────────────────
	type gatherOut struct {
		trendingPools []data.GeckoPoolData
		newPools      []data.GeckoPoolData
		boosted       []data.BoostedToken
		categories    []data.CoinCategory
		errs          []string
	}
	out := gatherOut{}
	var wg sync.WaitGroup
	var mu sync.Mutex

	network := data.ChainIDToNetwork(chainID)

	wg.Add(4)
	go func() {
		defer wg.Done()
		gecko := data.NewGeckoTerminalClient()
		pools, err := gecko.GetTrendingPoolsByNetwork(network)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			out.errs = append(out.errs, fmt.Sprintf("trending_pools: %v", err))
			return
		}
		out.trendingPools = pools
	}()
	go func() {
		defer wg.Done()
		gecko := data.NewGeckoTerminalClient()
		pools, err := gecko.GetNewPools(network)
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			out.errs = append(out.errs, fmt.Sprintf("new_pools: %v", err))
			return
		}
		out.newPools = pools
	}()
	go func() {
		defer wg.Done()
		dex := data.NewDexScreenerClient()
		boosted, err := dex.GetTopBoostedTokens()
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			out.errs = append(out.errs, fmt.Sprintf("boosts: %v", err))
			return
		}
		out.boosted = boosted
	}()
	go func() {
		defer wg.Done()
		cg := data.NewCoinGeckoClient()
		cats, err := cg.GetCategories()
		mu.Lock()
		defer mu.Unlock()
		if err != nil {
			out.errs = append(out.errs, fmt.Sprintf("categories: %v", err))
			return
		}
		out.categories = cats
	}()
	wg.Wait()

	result.Notes = append(result.Notes, out.errs...)

	// ── Stage 2: merge, dedupe, score ────────────────────────────────────
	topNarratives := topRisingCategoryKeywords(out.categories, 5)
	result.TopNarratives = topNarratives

	// Map of lowercased address → candidate
	candMap := make(map[string]*HuntCandidate)

	addFromPool := func(pool data.GeckoPoolData, source string) {
		addr := strings.ToLower(pool.BaseTokenAddress())
		if addr == "" || addr == "0x0000000000000000000000000000000000000000" {
			return
		}
		c, exists := candMap[addr]
		if !exists {
			c = &HuntCandidate{
				Address:       addr,
				PoolAddress:   pool.Attributes.Address,
				Name:          pool.Attributes.Name,
				PoolCreatedAt: pool.Attributes.PoolCreatedAt,
				Sources:       []string{},
			}
			candMap[addr] = c
		}
		c.Sources = appendUnique(c.Sources, source)

		// Take the max across duplicate sightings (different pools for same token)
		vol := parseFloat(pool.Attributes.GetVolumeH24())
		if vol > c.Volume24h {
			c.Volume24h = vol
		}
		reserve := parseFloat(pool.Attributes.ReserveUsd)
		if reserve > c.ReserveUsd {
			c.ReserveUsd = reserve
		}
		if h24 := parseFloat(pool.Attributes.PriceChangePct.H24); h24 != 0 {
			c.PriceChange24h = h24
		}
		if h1 := parseFloat(pool.Attributes.PriceChangePct.H1); h1 != 0 {
			c.PriceChange1h = h1
		}
		if b := pool.Attributes.Transactions.H24.Buys; b > c.Buys24h {
			c.Buys24h = b
		}
		if s := pool.Attributes.Transactions.H24.Sells; s > c.Sells24h {
			c.Sells24h = s
		}
	}

	for _, p := range out.trendingPools {
		addFromPool(p, "geckoterminal_trending")
	}
	for _, p := range out.newPools {
		addFromPool(p, "geckoterminal_new")
	}

	// Mark boost flag on existing candidates OR add as new (low priority)
	boostedChainStr := chainIDToDexChain(chainID)
	for _, bt := range out.boosted {
		if bt.TokenAddress == "" {
			continue
		}
		if boostedChainStr != "" && bt.ChainID != boostedChainStr {
			continue
		}
		addr := strings.ToLower(bt.TokenAddress)
		c, exists := candMap[addr]
		if !exists {
			c = &HuntCandidate{
				Address: addr,
				Name:    bt.Description,
				Sources: []string{"dexscreener_boost"},
				Boosted: true,
			}
			candMap[addr] = c
			continue
		}
		c.Boosted = true
		c.Sources = appendUnique(c.Sources, "dexscreener_boost")
	}

	result.Gathered = len(candMap)

	// Score each candidate and keep those above a floor
	ranked := make([]HuntCandidate, 0, len(candMap))
	for _, c := range candMap {
		score, breakdown, narrativeHit := scoreHuntCandidate(c, topNarratives)
		c.Score = score
		c.ScoreBreakdown = breakdown
		c.NarrativeHit = narrativeHit
		if score < 0 {
			continue // hard eliminations
		}
		ranked = append(ranked, *c)
	}

	// Sort by score descending (simple selection sort, small N)
	sortByScoreDesc(ranked)
	result.Scored = len(ranked)

	// ── Stage 3: full gate pipeline on top N ─────────────────────────────
	if len(ranked) > topN {
		ranked = ranked[:topN]
	}

	for i := range ranked {
		gates, err := RunGates(ranked[i].Address, chainID, true) // skipAI=true, fail-fast
		if err != nil {
			ranked[i].GateVerdict = "ERROR"
			ranked[i].GateReason = err.Error()
			continue
		}
		ranked[i].GateResult = gates
		ranked[i].GateVerdict = gates.Status
		if len(gates.Gates) > 0 && gates.FailedAt > 0 && gates.FailedAt <= len(gates.Gates) {
			failedGate := gates.Gates[gates.FailedAt-1]
			ranked[i].GateReason = failedGate.Reason
		} else if gates.Status == "PASS" {
			ranked[i].GateReason = "all automated gates cleared"
		}
	}
	result.GatesRan = len(ranked)
	result.Candidates = ranked
	return result, nil
}

// JSON serializes the hunt result.
func (h *HuntResult) JSON() string {
	b, _ := json.MarshalIndent(h, "", "  ")
	return string(b)
}

// scoreHuntCandidate computes a strike-likelihood score from embedded data only.
// Returns (score, human-readable breakdown, matched narrative label).
//
// Score weights (roughly 0-100 scale):
//   Liquidity floor:    hard gate (score=-1 if <$5k)
//   Volume tier:        0-15 (>$1M=15, >$250k=10, >$50k=6, <$10k=0)
//   Activity:           0-10 (txn count × buy ratio)
//   Price momentum:     0-15 (1h and 24h momentum, capped)
//   Narrative match:    0-15 (token name/symbol matches top-rising category)
//   Multi-source bonus: 0-10 (token in trending AND new_pools = +10)
//   Boost penalty:      -5 if boosted without backing volume (manufactured hype)
func scoreHuntCandidate(c *HuntCandidate, topNarratives []string) (float64, string, string) {
	// Hard floor: no liquidity = ghost token
	if c.ReserveUsd < 5_000 {
		return -1, "eliminated: liquidity<$5k", ""
	}

	var score float64
	parts := []string{}

	// Volume tier
	volScore := 0.0
	switch {
	case c.Volume24h >= 1_000_000:
		volScore = 15
	case c.Volume24h >= 250_000:
		volScore = 10
	case c.Volume24h >= 50_000:
		volScore = 6
	case c.Volume24h >= 10_000:
		volScore = 3
	}
	score += volScore
	parts = append(parts, fmt.Sprintf("vol=%.0f", volScore))

	// Activity + buy pressure
	totalTxns := c.Buys24h + c.Sells24h
	actScore := 0.0
	if totalTxns >= 50 {
		actScore = 4
		if totalTxns >= 200 {
			actScore = 7
		}
		if totalTxns >= 500 {
			actScore = 10
		}
		// Buy pressure kicker
		if totalTxns > 0 {
			buyRatio := float64(c.Buys24h) / float64(totalTxns)
			if buyRatio > 0.6 {
				actScore += 2
			} else if buyRatio < 0.4 {
				actScore -= 3 // dumping
			}
		}
	}
	score += actScore
	parts = append(parts, fmt.Sprintf("act=%.0f", actScore))

	// Price momentum (1h and 24h). Cap at ±15 to avoid runaway pumps.
	momScore := 0.0
	if c.PriceChange24h > 0 {
		momScore += minFloat(c.PriceChange24h/10, 8)
	} else if c.PriceChange24h < -15 {
		momScore -= 5
	}
	if c.PriceChange1h > 0 {
		momScore += minFloat(c.PriceChange1h/5, 7)
	}
	score += momScore
	parts = append(parts, fmt.Sprintf("mom=%.1f", momScore))

	// Narrative match: does name/symbol/pool-name contain a top-rising keyword?
	narrativeHit := ""
	needle := strings.ToLower(c.Name + " " + c.Symbol)
	narScore := 0.0
	for _, kw := range topNarratives {
		if kw == "" {
			continue
		}
		if strings.Contains(needle, kw) {
			narScore = 15
			narrativeHit = kw
			break
		}
	}
	score += narScore
	parts = append(parts, fmt.Sprintf("nar=%.0f", narScore))

	// Multi-source bonus: if surfaced by >1 list, that's a convergence signal
	msBonus := 0.0
	if len(c.Sources) >= 2 {
		msBonus = 6
	}
	if len(c.Sources) >= 3 {
		msBonus = 10
	}
	score += msBonus
	parts = append(parts, fmt.Sprintf("src=%.0f", msBonus))

	// Boost penalty: paid boost + weak volume = manufactured hype
	if c.Boosted && c.Volume24h < 25_000 {
		score -= 5
		parts = append(parts, "boost_trap=-5")
	} else if c.Boosted {
		parts = append(parts, "boost=+0")
	}

	return score, strings.Join(parts, " "), narrativeHit
}

// topRisingCategoryKeywords derives lowercased keywords from the top N
// rising CoinGecko categories (ranked by 24h market cap change).
// Used for narrative matching in scoreHuntCandidate.
func topRisingCategoryKeywords(cats []data.CoinCategory, n int) []string {
	if len(cats) == 0 {
		return nil
	}
	// Copy + sort by change desc
	sorted := make([]data.CoinCategory, len(cats))
	copy(sorted, cats)
	for i := 0; i < len(sorted); i++ {
		for j := i + 1; j < len(sorted); j++ {
			if sorted[j].MarketCapChange24h > sorted[i].MarketCapChange24h {
				sorted[i], sorted[j] = sorted[j], sorted[i]
			}
		}
	}
	if n > len(sorted) {
		n = len(sorted)
	}
	out := make([]string, 0, n)
	for _, c := range sorted[:n] {
		// Only include categories with POSITIVE 24h change as rising
		if c.MarketCapChange24h <= 0 {
			continue
		}
		// Split category name on whitespace; each word is a keyword candidate.
		// e.g. "AI & Big Data" → ["ai", "big", "data"]
		for _, word := range strings.Fields(strings.ToLower(c.Name)) {
			word = strings.Trim(word, "&()[]/,.")
			if len(word) >= 2 {
				out = append(out, word)
			}
		}
	}
	return out
}

// sortByScoreDesc sorts candidates in place by Score descending.
// Selection sort is fine here — we typically have <100 candidates.
func sortByScoreDesc(cs []HuntCandidate) {
	for i := 0; i < len(cs); i++ {
		for j := i + 1; j < len(cs); j++ {
			if cs[j].Score > cs[i].Score {
				cs[i], cs[j] = cs[j], cs[i]
			}
		}
	}
}

func appendUnique(xs []string, s string) []string {
	for _, x := range xs {
		if x == s {
			return xs
		}
	}
	return append(xs, s)
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

// chainIDToDexChain converts an EVM chain ID to DexScreener's string chain slug
// used in the boost payload. Returns "" if the chain isn't known.
func chainIDToDexChain(chainID int64) string {
	switch chainID {
	case 1:
		return "ethereum"
	case 56:
		return "bsc"
	case 137:
		return "polygon"
	case 42161:
		return "arbitrum"
	case 8453:
		return "base"
	}
	return ""
}
