package gates

import (
	"fmt"
	"math"
	"strings"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// SocialGate implements Gate 4: Social Momentum.
// Pure Go implementation — fetches social signals from multiple free APIs:
//   - Reddit (public JSON API, no auth)
//   - CoinGecko community data (twitter followers, reddit subs, telegram members)
//   - Farcaster (Neynar, free tier)
//   - DexScreener (trading activity as proxy)
//
// Scoring is deterministic based on mention count, engagement, recency, and reach.
type SocialGate struct {
	farcaster *data.FarcasterClient
	reddit    *data.RedditClient
	coingecko *data.CoinGeckoClient
}

func NewSocialGate() *SocialGate {
	return &SocialGate{
		farcaster: data.NewFarcasterClient(""),
		reddit:    data.NewRedditClient(),
		coingecko: data.NewCoinGeckoClient(),
	}
}

func (g *SocialGate) Name() string { return "Social Momentum" }
func (g *SocialGate) Number() int  { return 4 }

func (g *SocialGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

func (g *SocialGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	// Resolve token name and symbol from GoPlus data
	tokenName := ""
	tokenSymbol := ""
	if ctx.GoPlusData != nil {
		tokenName = ctx.GoPlusData.TokenName
		tokenSymbol = ctx.GoPlusData.TokenSymbol
	}

	// We need at least a name or symbol to search socials
	searchTerm := tokenSymbol
	if searchTerm == "" {
		searchTerm = tokenName
	}
	if searchTerm == "" {
		// Fallback: use token address (won't find much but avoids error)
		searchTerm = token
	}

	result.AddEvidence("token", "name", tokenName)
	result.AddEvidence("token", "symbol", tokenSymbol)
	result.AddEvidence("token", "search_term", searchTerm)

	// Score components (each 0-10, weighted and averaged)
	var scores []float64
	var weights []float64

	// --- 1. Reddit mentions ---
	redditScore := g.scoreReddit(result, searchTerm, tokenName)
	scores = append(scores, redditScore)
	weights = append(weights, 3.0)

	// --- 2. CoinGecko community data (cached from pipeline) ---
	cgScore := g.scoreCoinGeckoCached(result, ctx, searchTerm, tokenSymbol)
	scores = append(scores, cgScore)
	weights = append(weights, 3.0)

	// --- 3. Farcaster ---
	fcScore := g.scoreFarcaster(result, searchTerm)
	scores = append(scores, fcScore)
	weights = append(weights, 2.0)

	// --- 4. DexScreener activity (proxy for interest) ---
	dexScore := g.scoreDexActivity(result, ctx)
	scores = append(scores, dexScore)
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

	// Age-adjusted thresholds
	passThreshold := 5
	failThreshold := 3
	if ctx.Age == AgeFresh {
		// Fresh tokens get more lenient social thresholds (they're new)
		passThreshold = 4
		failThreshold = 2
	}

	if finalScore >= passThreshold {
		return result.Pass(fmt.Sprintf("Social momentum is positive (score: %d/10)", finalScore)), nil
	}
	if finalScore <= failThreshold {
		return result.Fail(fmt.Sprintf("Weak social signals (score: %d/10)", finalScore)), nil
	}
	return result.Warn(fmt.Sprintf("Social signals are mixed (score: %d/10)", finalScore)), nil
}

// scoreReddit fetches Reddit posts and scores based on count, engagement, recency.
func (g *SocialGate) scoreReddit(result *Result, searchTerm, tokenName string) float64 {
	query := searchTerm
	if tokenName != "" && tokenName != searchTerm {
		query = searchTerm + " OR " + tokenName
	}

	posts, err := g.reddit.SearchCryptoSubreddits(query, 25)
	if err != nil {
		result.AddEvidence("reddit", "error", err.Error())
		return 3 // neutral on error, don't penalize
	}

	result.AddEvidence("reddit", "posts_found", fmt.Sprintf("%d", len(posts)))

	if len(posts) == 0 {
		result.AddEvidence("reddit", "signal", "none")
		return 1
	}

	// Bucket posts by age and compute mention velocity
	now := time.Now().Unix()
	relevant := 0
	totalScore := 0
	totalComments := 0
	bucket1h := 0
	bucket6h := 0
	bucket24h := 0
	bucket48h := 0
	bucketWeek := 0

	for _, p := range posts {
		titleLower := strings.ToLower(p.Title)
		textLower := strings.ToLower(p.Selftext)
		termLower := strings.ToLower(searchTerm)

		if !strings.Contains(titleLower, termLower) && !strings.Contains(textLower, termLower) {
			continue
		}
		relevant++
		totalScore += p.Score
		totalComments += p.NumComments

		age := now - int64(p.CreatedUTC)
		switch {
		case age < 3600:
			bucket1h++
			bucket6h++
			bucket24h++
			bucket48h++
			bucketWeek++
		case age < 6*3600:
			bucket6h++
			bucket24h++
			bucket48h++
			bucketWeek++
		case age < 24*3600:
			bucket24h++
			bucket48h++
			bucketWeek++
		case age < 48*3600:
			bucket48h++
			bucketWeek++
		case age < 7*24*3600:
			bucketWeek++
		}
	}

	result.AddEvidence("reddit", "relevant_posts", fmt.Sprintf("%d", relevant))
	result.AddEvidence("reddit", "total_upvotes", fmt.Sprintf("%d", totalScore))
	result.AddEvidence("reddit", "total_comments", fmt.Sprintf("%d", totalComments))
	result.AddEvidence("reddit", "mentions_1h", fmt.Sprintf("%d", bucket1h))
	result.AddEvidence("reddit", "mentions_6h", fmt.Sprintf("%d", bucket6h))
	result.AddEvidence("reddit", "mentions_24h", fmt.Sprintf("%d", bucket24h))
	result.AddEvidence("reddit", "mentions_week", fmt.Sprintf("%d", bucketWeek))

	if relevant == 0 {
		return 2
	}

	score := 2.5 // base: at least one mention found

	// Volume tiers
	if relevant >= 3 {
		score += 0.5
	}
	if relevant >= 8 {
		score += 0.5
	}

	// Engagement tiers
	if totalScore > 50 {
		score += 0.5
	}
	if totalScore > 200 {
		score += 0.5
	}
	if totalScore > 1000 {
		score += 0.5
	}
	if totalComments > 20 {
		score += 0.5
	}
	if totalComments > 100 {
		score += 0.5
	}

	// Velocity / acceleration scoring — fresh mentions matter more than stale.
	// Compare 24h share vs week baseline. Acceleration > flat history.
	if bucketWeek > 0 {
		share24h := float64(bucket24h) / float64(bucketWeek)
		result.AddEvidence("reddit", "share_24h_of_week", fmt.Sprintf("%.2f", share24h))
		switch {
		case share24h > 0.60:
			score += 2 // mentions concentrated in last day = breakout
		case share24h > 0.35:
			score += 1.5
		case share24h > 0.20:
			score += 0.5
		}
	}
	if bucket1h >= 2 {
		score += 1.5 // active right now
	} else if bucket6h >= 3 {
		score += 1
	}

	if score < 1 {
		score = 1
	}
	if score > 10 {
		score = 10
	}
	return score
}

// scoreCoinGeckoCached uses pre-fetched CoinGecko data from pipeline context.
// Falls back to direct fetch if not cached.
func (g *SocialGate) scoreCoinGeckoCached(result *Result, ctx TokenContext, searchTerm, symbol string) float64 {
	if ctx.CoinGeckoFetched && ctx.CoinGeckoDetail != nil {
		result.AddEvidence("coingecko", "coin_id", ctx.CoinGeckoID)
		return g.scoreCoinGeckoDetail(result, ctx.CoinGeckoDetail)
	}
	// Fallback: fetch directly
	return g.scoreCoinGecko(result, searchTerm, symbol)
}

// scoreCoinGecko fetches community data (twitter, reddit, telegram).
func (g *SocialGate) scoreCoinGecko(result *Result, searchTerm, symbol string) float64 {
	searchResult, err := g.coingecko.SearchCoins(searchTerm)
	if err != nil {
		result.AddEvidence("coingecko", "search_error", err.Error())
		return 3
	}

	if len(searchResult.Coins) == 0 {
		result.AddEvidence("coingecko", "found", "false")
		return 2
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
	result.AddEvidence("coingecko", "coin_id", coinID)

	detail, err := g.coingecko.GetCoinDetail(coinID)
	if err != nil {
		result.AddEvidence("coingecko", "detail_error", err.Error())
		return 3
	}

	return g.scoreCoinGeckoDetail(result, detail)
}

// scoreCoinGeckoDetail scores community data from a CoinDetail.
func (g *SocialGate) scoreCoinGeckoDetail(result *Result, detail *data.CoinDetail) float64 {
	cd := detail.CommunityData
	result.AddEvidence("coingecko", "twitter_followers", fmt.Sprintf("%d", cd.TwitterFollowers))
	result.AddEvidence("coingecko", "reddit_subscribers", fmt.Sprintf("%d", cd.RedditSubscribers))
	result.AddEvidence("coingecko", "reddit_active_48h", fmt.Sprintf("%.0f", cd.RedditActive48h))
	result.AddEvidence("coingecko", "telegram_members", fmt.Sprintf("%d", cd.TelegramMembers))
	result.AddEvidence("coingecko", "watchlist_users", fmt.Sprintf("%d", detail.WatchlistUsers))

	if detail.SentimentUpVotes > 0 {
		result.AddEvidence("coingecko", "sentiment_up", fmt.Sprintf("%.1f%%", detail.SentimentUpVotes))
		result.AddEvidence("coingecko", "sentiment_down", fmt.Sprintf("%.1f%%", detail.SentimentDownVotes))
	}

	// Social links presence
	hasTwitter := detail.Links.Twitter != ""
	hasTelegram := detail.Links.Telegram != ""
	hasReddit := detail.Links.Subreddit != ""
	result.AddEvidence("coingecko", "has_twitter", fmt.Sprintf("%v", hasTwitter))
	result.AddEvidence("coingecko", "has_telegram", fmt.Sprintf("%v", hasTelegram))
	result.AddEvidence("coingecko", "has_subreddit", fmt.Sprintf("%v", hasReddit))

	score := 3.0 // base: listed on CoinGecko

	// Twitter followers scoring
	if cd.TwitterFollowers > 1000 {
		score += 1
	}
	if cd.TwitterFollowers > 10000 {
		score += 1
	}
	if cd.TwitterFollowers > 100000 {
		score += 1
	}

	// Reddit scoring
	if cd.RedditSubscribers > 500 {
		score += 0.5
	}
	if cd.RedditActive48h > 100 {
		score += 0.5
	}

	// Telegram scoring
	if cd.TelegramMembers > 1000 {
		score += 0.5
	}
	if cd.TelegramMembers > 10000 {
		score += 0.5
	}

	// Watchlist users (CoinGecko portfolio)
	if detail.WatchlistUsers > 500 {
		score += 0.5
	}
	if detail.WatchlistUsers > 5000 {
		score += 0.5
	}

	// Sentiment bonus
	if detail.SentimentUpVotes > 70 {
		score += 0.5
	}

	if score > 10 {
		score = 10
	}
	return score
}

// scoreFarcaster fetches Farcaster casts and scores engagement.
func (g *SocialGate) scoreFarcaster(result *Result, searchTerm string) float64 {
	casts, err := g.farcaster.SearchCasts(searchTerm)
	if err != nil {
		result.AddEvidence("farcaster", "error", err.Error())
		return 3 // neutral
	}

	result.AddEvidence("farcaster", "casts_found", fmt.Sprintf("%d", len(casts)))

	if len(casts) == 0 {
		return 2
	}

	totalEngagement := 0
	totalFollowers := 0
	for i, c := range casts {
		if i >= 15 {
			break
		}
		totalEngagement += c.Reactions.Likes + c.Reactions.Recasts + c.Replies.Count
		totalFollowers += c.Author.Followers
	}

	result.AddEvidence("farcaster", "total_engagement", fmt.Sprintf("%d", totalEngagement))
	result.AddEvidence("farcaster", "avg_author_followers", fmt.Sprintf("%d", totalFollowers/max(len(casts), 1)))

	score := 3.0
	if len(casts) >= 5 {
		score += 1
	}
	if len(casts) >= 15 {
		score += 1
	}
	if totalEngagement > 20 {
		score += 1
	}
	if totalEngagement > 100 {
		score += 1
	}
	if totalFollowers > 10000 {
		score += 1
	}
	if totalFollowers > 50000 {
		score += 1
	}

	if score > 10 {
		score = 10
	}
	return score
}

// scoreDexActivity uses real DexScreener pair data — txn velocity, buy/sell
// pressure, volume acceleration — as a deterministic social/demand proxy.
// Also computes boost-to-organic ratio: high boost without organic engagement
// is a manufactured-hype trap and gets penalized.
func (g *SocialGate) scoreDexActivity(result *Result, ctx TokenContext) float64 {
	if !ctx.DexPairsFetched || len(ctx.DexPairs) == 0 {
		return 3
	}

	// Pick the deepest-liquidity pair as the primary signal
	var primary *data.DexPair
	bestLiq := 0.0
	for i := range ctx.DexPairs {
		if ctx.DexPairs[i].Liquidity.Usd > bestLiq {
			bestLiq = ctx.DexPairs[i].Liquidity.Usd
			primary = &ctx.DexPairs[i]
		}
	}
	if primary == nil {
		return 3
	}

	// Aggregate txn counts across windows
	buys24 := primary.Txns.H24.Buys
	sells24 := primary.Txns.H24.Sells
	total24 := buys24 + sells24
	buys6 := primary.Txns.H6.Buys + primary.Txns.H6.Sells
	buys1 := primary.Txns.H1.Buys + primary.Txns.H1.Sells

	result.AddEvidence("dex_activity", "txns_24h", fmt.Sprintf("%d", total24))
	result.AddEvidence("dex_activity", "buys_24h", fmt.Sprintf("%d", buys24))
	result.AddEvidence("dex_activity", "sells_24h", fmt.Sprintf("%d", sells24))
	result.AddEvidence("dex_activity", "txns_6h", fmt.Sprintf("%d", buys6))
	result.AddEvidence("dex_activity", "txns_1h", fmt.Sprintf("%d", buys1))
	result.AddEvidence("dex_activity", "volume_24h_usd", fmt.Sprintf("%.0f", primary.Volume.H24))

	score := 2.0

	// Volume tiers
	switch {
	case primary.Volume.H24 > 5_000_000:
		score += 3
	case primary.Volume.H24 > 1_000_000:
		score += 2.5
	case primary.Volume.H24 > 250_000:
		score += 2
	case primary.Volume.H24 > 50_000:
		score += 1
	case primary.Volume.H24 > 10_000:
		score += 0.5
	}

	// Txn count tiers (organic interest breadth)
	switch {
	case total24 > 5000:
		score += 2
	case total24 > 1000:
		score += 1.5
	case total24 > 200:
		score += 1
	case total24 > 50:
		score += 0.5
	}

	// Buy pressure: more buys than sells = demand wave
	if total24 > 50 {
		buyRatio := float64(buys24) / float64(total24)
		result.AddEvidence("dex_activity", "buy_ratio", fmt.Sprintf("%.2f", buyRatio))
		if buyRatio > 0.60 {
			score += 1.5
		} else if buyRatio > 0.52 {
			score += 0.5
		} else if buyRatio < 0.40 {
			score -= 1.5 // dump in progress
		}
	}

	// Velocity: 1h share of 24h activity. Healthy momentum > 1/24, hot > 1/12.
	if total24 > 100 && buys1 > 0 {
		share1h := float64(buys1) / float64(total24)
		result.AddEvidence("dex_activity", "txn_1h_share", fmt.Sprintf("%.3f", share1h))
		switch {
		case share1h > 0.15:
			score += 1.5 // accelerating hard
		case share1h > 0.08:
			score += 1
		case share1h > 0.04:
			score += 0.5
		}
	}

	// Boost-to-organic check: paid promotion with no organic backing = trap.
	if ctx.BoostedTokensFetched {
		boosted := false
		boostAmount := 0.0
		addrLower := strings.ToLower(getPrimaryTokenAddress(primary))
		for _, b := range ctx.BoostedTokens {
			if strings.ToLower(b.TokenAddress) == addrLower {
				boosted = true
				boostAmount = b.TotalAmount
				break
			}
		}
		result.AddEvidence("dex_activity", "is_boosted", fmt.Sprintf("%v", boosted))
		if boosted {
			result.AddEvidence("dex_activity", "boost_amount", fmt.Sprintf("%.0f", boostAmount))
			// Boosted but volume is anemic = manufactured trap
			if primary.Volume.H24 < 25_000 || total24 < 100 {
				result.AddEvidence("dex_activity", "verdict", "manufactured_hype")
				score -= 2
			}
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

// getPrimaryTokenAddress returns the base token address from a pair (the
// token being analyzed, not the quote currency).
func getPrimaryTokenAddress(p *data.DexPair) string {
	return p.BaseToken.Address
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
