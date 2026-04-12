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

	// Count relevant posts (title or body mentions token)
	now := time.Now().Unix()
	relevant := 0
	totalScore := 0
	totalComments := 0
	recentCount := 0 // posts from last 48h

	for _, p := range posts {
		titleLower := strings.ToLower(p.Title)
		textLower := strings.ToLower(p.Selftext)
		termLower := strings.ToLower(searchTerm)

		if strings.Contains(titleLower, termLower) || strings.Contains(textLower, termLower) {
			relevant++
			totalScore += p.Score
			totalComments += p.NumComments

			age := now - int64(p.CreatedUTC)
			if age < 48*3600 {
				recentCount++
			}
		}
	}

	result.AddEvidence("reddit", "relevant_posts", fmt.Sprintf("%d", relevant))
	result.AddEvidence("reddit", "total_upvotes", fmt.Sprintf("%d", totalScore))
	result.AddEvidence("reddit", "total_comments", fmt.Sprintf("%d", totalComments))
	result.AddEvidence("reddit", "recent_48h", fmt.Sprintf("%d", recentCount))

	if relevant == 0 {
		return 2
	}

	score := 3.0 // base: found mentions
	if relevant >= 3 {
		score += 1
	}
	if relevant >= 8 {
		score += 1
	}
	if totalScore > 50 {
		score += 1
	}
	if totalScore > 200 {
		score += 1
	}
	if totalComments > 20 {
		score += 1
	}
	if recentCount >= 2 {
		score += 1
	}
	if recentCount >= 5 {
		score += 1
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

// scoreDexActivity uses DexScreener trading data as a proxy for social interest.
func (g *SocialGate) scoreDexActivity(result *Result, ctx TokenContext) float64 {
	// We don't re-fetch — use data already available from gate context
	// DexScreener data from Gate 2 already shows volume + txn counts.
	// Here we score the velocity of activity as social proxy.
	if ctx.GoPlusData == nil {
		return 3
	}

	// This data comes indirectly — just check holder count as proxy.
	// High holder count = high social spread.
	holders := 0
	fmt.Sscanf(ctx.GoPlusData.HolderCount, "%d", &holders)

	result.AddEvidence("dex_proxy", "holder_count", fmt.Sprintf("%d", holders))

	score := 3.0
	if holders > 100 {
		score += 1
	}
	if holders > 1000 {
		score += 1
	}
	if holders > 10000 {
		score += 1
	}
	if holders > 100000 {
		score += 2
	}
	if holders > 1000000 {
		score += 1
	}

	if score > 10 {
		score = 10
	}
	return score
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}
