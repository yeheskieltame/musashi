package gates

import (
	"fmt"
	"math"
	"strings"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

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
// Updated periodically to reflect current market meta.
var hotNarratives = map[string][]string{
	"AI":       {"ai", "artificial intelligence", "machine learning", "llm", "neural", "gpt", "agent"},
	"RWA":      {"rwa", "real world asset", "tokenized", "treasury"},
	"DePIN":    {"depin", "physical infrastructure", "iot", "sensor", "wireless"},
	"Meme":     {"meme", "doge", "pepe", "shib", "inu", "cat", "frog", "bonk"},
	"L2":       {"layer 2", "l2", "rollup", "zk", "optimistic"},
	"DeFi":     {"defi", "dex", "lending", "yield", "amm", "swap", "liquidity"},
	"Gaming":   {"gaming", "game", "metaverse", "play", "nft"},
	"Privacy":  {"privacy", "zero knowledge", "zk", "mixer"},
	"Staking":  {"staking", "restaking", "liquid staking", "lst", "lrt"},
	"SocialFi": {"socialfi", "social", "creator", "fan token"},
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

	// --- 3. DexScreener boosted ---
	boostScore := g.scoreBoosted(result, token)
	scores = append(scores, boostScore)
	weights = append(weights, 2.0)

	// --- 4. Name/symbol narrative keyword match ---
	kwScore := g.scoreKeywordMatch(result, tokenName, tokenSymbol, narrative)
	scores = append(scores, kwScore)
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

	// Ordered narrative check — more specific narratives first
	narrativeOrder := []string{"Meme", "AI", "RWA", "DePIN", "Gaming", "L2", "DeFi", "Staking", "SocialFi", "Privacy"}
	for _, narr := range narrativeOrder {
		keywords := hotNarratives[narr]
		for _, catLower := range categoriesLower {
			for _, kw := range keywords {
				if strings.Contains(catLower, kw) {
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

// scoreBoosted checks if token is being promoted on DexScreener.
func (g *NarrativeGate) scoreBoosted(result *Result, tokenAddress string) float64 {
	boosted, err := g.dex.GetBoostedTokens()
	if err != nil {
		result.AddEvidence("dexscreener", "boost_error", err.Error())
		return 3
	}

	addressLower := strings.ToLower(tokenAddress)
	isBoosted := false

	for _, raw := range boosted {
		rawStr := string(raw)
		if strings.Contains(strings.ToLower(rawStr), addressLower) {
			isBoosted = true
			break
		}
	}

	result.AddEvidence("dexscreener", "is_boosted", fmt.Sprintf("%v", isBoosted))

	if isBoosted {
		// Boosted is a mixed signal — someone is paying to promote.
		// Could be legit marketing or could be a rug trying to attract buyers.
		return 6 // slightly positive but cautious
	}
	return 4 // neutral
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
			if strings.Contains(nameLower, kw) || strings.Contains(symbolLower, kw) {
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
