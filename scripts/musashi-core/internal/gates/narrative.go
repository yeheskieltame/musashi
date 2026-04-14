package gates

import (
	"fmt"
	"math"
	"strings"
	"unicode"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// matchKeyword checks whether `keyword` appears in `haystack` as a whole word
// or contiguous phrase, not as a mid-word substring.
//
// Motivation: raw strings.Contains produced false positives on short
// keywords. Example: keyword "mew" (Solana memecoin) matched category
// "AI Framework" because "mew" is inside "fra-mew-ork". Keyword "wif" could
// match "swift". Keyword "ai " (with trailing space) was a hack workaround.
//
// Rules:
//   - If keyword contains spaces (multi-word phrase), require that the exact
//     phrase occurs in the haystack with word boundaries on both ends.
//   - If keyword is a single word, require it to appear as a full word
//     separated by non-alphanumerics (start-of-string, end-of-string, or
//     any non-alphanumeric character).
func matchKeyword(haystack, keyword string) bool {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return false
	}
	idx := 0
	for {
		found := strings.Index(haystack[idx:], keyword)
		if found < 0 {
			return false
		}
		start := idx + found
		end := start + len(keyword)

		// Check left boundary: start of string OR previous char is non-alphanumeric
		leftOK := start == 0 || !isWordChar(rune(haystack[start-1]))
		// Check right boundary: end of string OR next char is non-alphanumeric
		rightOK := end == len(haystack) || !isWordChar(rune(haystack[end]))

		if leftOK && rightOK {
			return true
		}
		idx = start + 1
		if idx >= len(haystack) {
			return false
		}
	}
}

// isWordChar returns true for letters and digits (word characters for
// boundary detection purposes).
func isWordChar(r rune) bool {
	return unicode.IsLetter(r) || unicode.IsDigit(r)
}

// NarrativeGate implements Gate 5: Narrative Alignment.
// Pure Go implementation — determines if token's narrative fits current market meta:
//   - CoinGecko categories (what narrative bucket does this token belong to)
//   - CoinGecko trending (is this token or its narrative trending)
//   - DexScreener boosted (is someone promoting it)
//   - Keyword matching for hot narrative sectors
//
// Scoring is deterministic: category health, trend alignment, copycat detection.
type NarrativeGate struct {
	coingecko *data.CoinGeckoClient
	dex       *data.DexScreenerClient
}

func NewNarrativeGate() *NarrativeGate {
	return &NarrativeGate{
		coingecko: data.NewCoinGeckoClient(),
		dex:       data.NewDexScreenerClient(),
	}
}

func (g *NarrativeGate) Name() string { return "Narrative Alignment" }
func (g *NarrativeGate) Number() int  { return 5 }

func (g *NarrativeGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

// Hot narrative keywords — tokens matching these get a narrative bonus.
// Refreshed for 2026 market meta. Order matters: more specific narratives
// (AI Agents, Bitcoin L2) checked before broader ones (AI, L2).
var hotNarratives = map[string][]string{
	"AI Agents":       {"ai agent", "autonomous agent", "agent framework", "swarm"},
	"AI":              {"artificial intelligence", "machine learning", "llm", "neural", "gpt", "ai"},
	"DeSci":           {"desci", "decentralized science", "longevity", "biotech"},
	"RWA":             {"rwa", "real world asset", "tokenized", "treasury bill", "t-bill"},
	"DePIN":           {"depin", "physical infrastructure", "iot", "sensor", "wireless network"},
	"Bitcoin L2":      {"bitcoin l2", "btc l2", "babylon", "stacks", "rune"},
	"Solana Memecoin": {"pump.fun", "pumpfun", "bonk", "wif", "popcat", "mew"},
	"TON Ecosystem":   {"telegram", "ton ", "notcoin", "hamster", "dogs"},
	"Hyperliquid":     {"hyperliquid", "hyperliquid ecosystem"},
	"Meme":            {"meme", "doge", "pepe", "shib", "inu", "cat", "frog"},
	"L2":              {"layer 2", "l2", "rollup", "zk rollup", "optimistic"},
	"Restaking":       {"restaking", "eigenlayer", "lrt", "liquid restaking"},
	"Staking":         {"staking", "liquid staking", "lst"},
	"DeFi":            {"defi", "dex", "lending", "yield", "amm", "swap", "liquidity"},
	"Gaming":          {"gaming", "game", "metaverse", "play to earn", "p2e"},
	"Privacy":         {"privacy", "zero knowledge", "zk", "mixer"},
	"SocialFi":        {"socialfi", "social", "creator", "fan token"},
}

// narrativeOrder is the priority order for category->narrative matching.
// More specific narratives must come first.
var narrativeOrder = []string{
	"AI Agents", "Solana Memecoin", "TON Ecosystem", "Hyperliquid",
	"Bitcoin L2", "DeSci", "Restaking",
	"AI", "RWA", "DePIN", "Meme", "Gaming", "L2",
	"Staking", "DeFi", "SocialFi", "Privacy",
}

func (g *NarrativeGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	tokenName := ""
	tokenSymbol := ""
	if ctx.GoPlusData != nil {
		tokenName = ctx.GoPlusData.TokenName
		tokenSymbol = ctx.GoPlusData.TokenSymbol
	}

	searchTerm := tokenSymbol
	if searchTerm == "" {
		searchTerm = tokenName
	}
	if searchTerm == "" {
		searchTerm = token
	}

	result.AddEvidence("token", "name", tokenName)
	result.AddEvidence("token", "symbol", tokenSymbol)

	var scores []float64
	var weights []float64

	// --- 1. Narrative identification via CoinGecko categories (cached) ---
	catScore, narrative := g.scoreCategoriesCached(result, ctx, searchTerm, tokenSymbol, tokenName)
	scores = append(scores, catScore)
	weights = append(weights, 3.0)

	// --- 2. Trending status ---
	trendScore := g.scoreTrending(result, searchTerm, tokenSymbol)
	scores = append(scores, trendScore)
	weights = append(weights, 3.0)

	// --- 3. DexScreener boost vs organic check ---
	boostScore := g.scoreBoosted(result, token, ctx)
	scores = append(scores, boostScore)
	weights = append(weights, 2.5)

	// --- 4. Name/symbol narrative keyword match ---
	kwScore := g.scoreKeywordMatch(result, tokenName, tokenSymbol, narrative)
	scores = append(scores, kwScore)
	weights = append(weights, 1.5)

	// --- 5. Narrative landscape: is this token's category currently rising? ---
	landscapeScore := g.scoreLandscape(result, ctx, narrative)
	scores = append(scores, landscapeScore)
	weights = append(weights, 2.0)

	// Weighted average
	totalWeight := 0.0
	weightedSum := 0.0
	for i, s := range scores {
		weightedSum += s * weights[i]
		totalWeight += weights[i]
	}
	finalScore := int(math.Round(weightedSum / totalWeight))
	if finalScore < 1 {
		finalScore = 1
	}
	if finalScore > 10 {
		finalScore = 10
	}

	result.AddEvidence("analysis", "final_score", fmt.Sprintf("%d/10", finalScore))
	if narrative != "" {
		result.AddEvidence("analysis", "narrative", narrative)
	}

	// Thresholds
	passThreshold := 5
	failThreshold := 3
	if ctx.Age == AgeFresh {
		passThreshold = 4
		failThreshold = 2
	}

	if finalScore >= passThreshold {
		msg := fmt.Sprintf("Narrative is well-aligned with current market meta (score: %d/10)", finalScore)
		if narrative != "" {
			msg = fmt.Sprintf("Narrative [%s] is well-aligned (score: %d/10)", narrative, finalScore)
		}
		return result.Pass(msg), nil
	}
	if finalScore <= failThreshold {
		return result.Fail(fmt.Sprintf("Narrative is weak or oversaturated (score: %d/10)", finalScore)), nil
	}
	return result.Warn(fmt.Sprintf("Narrative alignment is uncertain (score: %d/10)", finalScore)), nil
}

// scoreCategoriesCached uses pre-fetched CoinGecko data from pipeline context.
func (g *NarrativeGate) scoreCategoriesCached(result *Result, ctx TokenContext, searchTerm, symbol, name string) (float64, string) {
	if ctx.CoinGeckoFetched && ctx.CoinGeckoDetail != nil {
		return g.scoreCoinGeckoDetail(result, ctx.CoinGeckoDetail)
	}
	return g.scoreCategories(result, searchTerm, symbol, name)
}

// scoreCategories identifies which narrative the token belongs to via CoinGecko.
func (g *NarrativeGate) scoreCategories(result *Result, searchTerm, symbol, name string) (float64, string) {
	searchResult, err := g.coingecko.SearchCoins(searchTerm)
	if err != nil {
		result.AddEvidence("coingecko", "search_error", err.Error())
		return 3, ""
	}

	if len(searchResult.Coins) == 0 {
		result.AddEvidence("coingecko", "listed", "false")
		return 2, ""
	}

	var coinID string
	for _, coin := range searchResult.Coins {
		if strings.EqualFold(coin.Symbol, symbol) {
			coinID = coin.ID
			break
		}
	}
	if coinID == "" {
		coinID = searchResult.Coins[0].ID
	}

	detail, err := g.coingecko.GetCoinDetail(coinID)
	if err != nil {
		result.AddEvidence("coingecko", "detail_error", err.Error())
		return 3, ""
	}

	return g.scoreCoinGeckoDetail(result, detail)
}

// scoreCoinGeckoDetail extracts narrative from CoinGecko detail.
func (g *NarrativeGate) scoreCoinGeckoDetail(result *Result, detail *data.CoinDetail) (float64, string) {
	if len(detail.Categories) > 0 {
		result.AddEvidence("coingecko", "categories", strings.Join(detail.Categories, ", "))
	}

	// Check if any category matches hot narratives.
	// Check categories in order: first match on category name wins.
	// This ensures "Meme" category matches "Meme" narrative, not "AI".
	narrative := ""
	categoriesLower := make([]string, len(detail.Categories))
	for i, c := range detail.Categories {
		categoriesLower[i] = strings.ToLower(c)
	}

	// Ordered narrative check — more specific narratives first.
	//
	// Uses WORD-BOUNDARY matching, not raw substring. Real bug caught during
	// 0G Labs analysis: short keyword "mew" (Solana memecoin) was matching
	// "AI Framework" category because "mew" appears inside "fra-mew-ork".
	// This classified 0G (an L1 AI infra token) as Solana Memecoin.
	//
	// Fix: matchKeyword() enforces word boundaries so single-word keywords
	// only match complete words, and multi-word keywords only match as a
	// contiguous phrase.
	for _, narr := range narrativeOrder {
		keywords := hotNarratives[narr]
		for _, catLower := range categoriesLower {
			for _, kw := range keywords {
				if matchKeyword(catLower, kw) {
					narrative = narr
					break
				}
			}
			if narrative != "" {
				break
			}
		}
		if narrative != "" {
			break
		}
	}

	result.AddEvidence("coingecko", "matched_narrative", narrative)

	score := 3.0 // base: listed
	if len(detail.Categories) > 0 {
		score += 1
	}
	if narrative != "" {
		score += 2 // matches hot narrative
	}
	// Market cap rank as narrative maturity signal
	rank := detail.MarketData.MarketCapRank
	if rank > 0 && rank <= 100 {
		score += 2
	} else if rank > 0 && rank <= 500 {
		score += 1
	}

	if score > 10 {
		score = 10
	}
	return score, narrative
}

// scoreTrending checks if token or its narrative is on CoinGecko trending.
func (g *NarrativeGate) scoreTrending(result *Result, searchTerm, symbol string) float64 {
	trending, err := g.coingecko.GetTrending()
	if err != nil {
		result.AddEvidence("trending", "error", err.Error())
		return 3
	}

	isTrending := false
	symbolLower := strings.ToLower(symbol)
	searchLower := strings.ToLower(searchTerm)

	for _, coin := range trending.Coins {
		coinSymbol := strings.ToLower(coin.Item.Symbol)
		coinName := strings.ToLower(coin.Item.Name)

		if coinSymbol == symbolLower || coinName == searchLower {
			isTrending = true
			result.AddEvidence("trending", "rank", fmt.Sprintf("%d", coin.Item.Score+1))
			break
		}
	}

	result.AddEvidence("trending", "is_trending", fmt.Sprintf("%v", isTrending))
	result.AddEvidence("trending", "total_trending", fmt.Sprintf("%d", len(trending.Coins)))

	if isTrending {
		return 9 // very strong signal
	}
	return 4 // neutral — most tokens aren't trending
}

// scoreBoosted checks if a token is being promoted on DexScreener and
// cross-references organic signals to detect manufactured hype traps.
//
// Logic:
//   - boost present + organic strong  → mild positive (legit marketing)
//   - boost present + organic absent  → strong negative (manufactured trap)
//   - no boost + organic strong       → strong positive (sleeper)
//   - no boost + organic absent       → neutral
func (g *NarrativeGate) scoreBoosted(result *Result, tokenAddress string, ctx TokenContext) float64 {
	var boosted []data.BoostedToken
	if ctx.BoostedTokensFetched {
		boosted = ctx.BoostedTokens
	} else {
		fetched, err := g.dex.GetBoostedTokens()
		if err != nil {
			result.AddEvidence("dexscreener", "boost_error", err.Error())
			return 3
		}
		boosted = fetched
	}

	addressLower := strings.ToLower(tokenAddress)
	isBoosted := false
	boostAmount := 0.0
	for _, b := range boosted {
		if strings.ToLower(b.TokenAddress) == addressLower {
			isBoosted = true
			boostAmount = b.TotalAmount
			break
		}
	}

	result.AddEvidence("dexscreener", "is_boosted", fmt.Sprintf("%v", isBoosted))
	if isBoosted {
		result.AddEvidence("dexscreener", "boost_amount", fmt.Sprintf("%.0f", boostAmount))
	}

	// Determine organic strength from cached signals
	organic := organicStrength(ctx)
	result.AddEvidence("dexscreener", "organic_strength", organic)

	switch {
	case isBoosted && organic == "strong":
		return 7 // legit marketing on top of real demand
	case isBoosted && organic == "moderate":
		return 5
	case isBoosted && organic == "weak":
		result.AddEvidence("dexscreener", "verdict", "manufactured_hype")
		return 1 // paid promo with no organic = trap
	case !isBoosted && organic == "strong":
		return 8 // quiet sleeper with real interest
	case !isBoosted && organic == "moderate":
		return 5
	default:
		return 3
	}
}

// organicStrength derives a coarse organic-engagement label from cached signals.
// Uses CoinGecko community + DexScreener volume + holder count.
func organicStrength(ctx TokenContext) string {
	score := 0

	if ctx.CoinGeckoFetched && ctx.CoinGeckoDetail != nil {
		cd := ctx.CoinGeckoDetail.CommunityData
		if cd.TwitterFollowers > 5000 {
			score += 2
		} else if cd.TwitterFollowers > 500 {
			score += 1
		}
		if cd.TelegramMembers > 2000 {
			score += 1
		}
		if cd.RedditActive48h > 50 {
			score += 1
		}
		if ctx.CoinGeckoDetail.WatchlistUsers > 1000 {
			score += 1
		}
	}

	if ctx.DexPairsFetched && len(ctx.DexPairs) > 0 {
		var bestVol float64
		var bestTxns int
		for _, p := range ctx.DexPairs {
			if p.Volume.H24 > bestVol {
				bestVol = p.Volume.H24
			}
			if t := p.Txns.H24.Buys + p.Txns.H24.Sells; t > bestTxns {
				bestTxns = t
			}
		}
		if bestVol > 500_000 {
			score += 2
		} else if bestVol > 100_000 {
			score += 1
		}
		if bestTxns > 1000 {
			score += 2
		} else if bestTxns > 200 {
			score += 1
		}
	}

	switch {
	case score >= 5:
		return "strong"
	case score >= 2:
		return "moderate"
	default:
		return "weak"
	}
}

// scoreLandscape checks whether the token's category sits inside the current
// top-rising CoinGecko categories (24h market cap gain). Catches narrative
// rotations even if the token doesn't match a hardcoded keyword.
func (g *NarrativeGate) scoreLandscape(result *Result, ctx TokenContext, narrative string) float64 {
	if !ctx.NarrativeLandscapeFetched || len(ctx.NarrativeLandscape) == 0 {
		return 4
	}
	if !ctx.CoinGeckoFetched || ctx.CoinGeckoDetail == nil || len(ctx.CoinGeckoDetail.Categories) == 0 {
		// Can't tell which category the token is in
		// Still surface top-rising categories as evidence for the agent
		topRising := topRisingCategories(ctx.NarrativeLandscape, 5)
		result.AddEvidence("landscape", "top_rising", strings.Join(topRising, ", "))
		return 4
	}

	// Build a set of category names rising > 0% in last 24h, and their gain
	gainByCat := map[string]float64{}
	for _, c := range ctx.NarrativeLandscape {
		gainByCat[strings.ToLower(c.Name)] = c.MarketCapChange24h
	}

	// Find the best 24h gain among the token's categories
	bestGain := -100.0
	matchedCat := ""
	for _, cat := range ctx.CoinGeckoDetail.Categories {
		if g, ok := gainByCat[strings.ToLower(cat)]; ok {
			if g > bestGain {
				bestGain = g
				matchedCat = cat
			}
		}
	}

	topRising := topRisingCategories(ctx.NarrativeLandscape, 5)
	result.AddEvidence("landscape", "top_rising_categories", strings.Join(topRising, ", "))

	if matchedCat == "" {
		return 4
	}
	result.AddEvidence("landscape", "token_category", matchedCat)
	result.AddEvidence("landscape", "category_24h_change", fmt.Sprintf("%.2f%%", bestGain))

	score := 4.0
	switch {
	case bestGain > 15:
		score = 9 // narrative is exploding
	case bestGain > 7:
		score = 8
	case bestGain > 3:
		score = 7
	case bestGain > 0:
		score = 6
	case bestGain > -3:
		score = 4
	case bestGain > -7:
		score = 3
	default:
		score = 2 // narrative bleeding out
	}
	return score
}

// topRisingCategories returns the top-N CoinGecko categories ranked by 24h gain.
func topRisingCategories(cats []data.CoinCategory, n int) []string {
	type rank struct {
		name string
		gain float64
	}
	ranks := make([]rank, 0, len(cats))
	for _, c := range cats {
		ranks = append(ranks, rank{c.Name, c.MarketCapChange24h})
	}
	// simple selection top-n
	for i := 0; i < n && i < len(ranks); i++ {
		maxIdx := i
		for j := i + 1; j < len(ranks); j++ {
			if ranks[j].gain > ranks[maxIdx].gain {
				maxIdx = j
			}
		}
		ranks[i], ranks[maxIdx] = ranks[maxIdx], ranks[i]
	}
	out := make([]string, 0, n)
	for i := 0; i < n && i < len(ranks); i++ {
		out = append(out, fmt.Sprintf("%s(%+.1f%%)", ranks[i].name, ranks[i].gain))
	}
	return out
}

// scoreKeywordMatch checks if token name/symbol directly matches hot narrative keywords.
func (g *NarrativeGate) scoreKeywordMatch(result *Result, name, symbol, alreadyMatched string) float64 {
	if name == "" && symbol == "" {
		return 3
	}

	nameLower := strings.ToLower(name)
	symbolLower := strings.ToLower(symbol)

	matched := []string{}
	for narr, keywords := range hotNarratives {
		if narr == alreadyMatched {
			continue // already scored in categories
		}
		for _, kw := range keywords {
			// Word-boundary match (same fix as scoreCoinGeckoDetail).
			// Prevents short keywords from substring-matching unrelated
			// token names/symbols.
			if matchKeyword(nameLower, kw) || matchKeyword(symbolLower, kw) {
				matched = append(matched, narr)
				break
			}
		}
	}

	if len(matched) > 0 {
		result.AddEvidence("keyword", "matched_narratives", strings.Join(matched, ", "))
	}

	score := 4.0 // base neutral
	if len(matched) > 0 {
		score += 2
	}
	if len(matched) > 1 {
		score += 1 // multi-narrative alignment
	}
	// If name contains generic/copycat signals, penalize slightly
	copycatSignals := []string{"2.0", "v2", "classic", "new", "baby", "mini", "safe"}
	for _, sig := range copycatSignals {
		if strings.Contains(nameLower, sig) {
			result.AddEvidence("keyword", "copycat_signal", sig)
			score -= 1
			break
		}
	}

	if score < 1 {
		score = 1
	}
	if score > 10 {
		score = 10
	}
	return score
}
