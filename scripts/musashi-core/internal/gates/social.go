package gates

import (
	"fmt"
	"strings"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/agent"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// SocialGate implements Gate 4: Social Momentum.
// Uses Farcaster API data + AI agent (Sonnet) with WebSearch to analyze
// social signals from multiple sources: Twitter/X, Farcaster, Reddit,
// Telegram mentions, crypto forums, and DexScreener social links.
type SocialGate struct {
	farcaster *data.FarcasterClient
}

func NewSocialGate() *SocialGate {
	return &SocialGate{
		farcaster: data.NewFarcasterClient(""),
	}
}

func (g *SocialGate) Name() string { return "Social Momentum" }
func (g *SocialGate) Number() int  { return 4 }

func (g *SocialGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

func (g *SocialGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	// Step 1: Fetch Farcaster data (free API, gives us initial social signal)
	var farcasterSummary string
	casts, err := g.farcaster.SearchCasts(token)
	if err != nil {
		farcasterSummary = fmt.Sprintf("Farcaster search failed: %v", err)
		result.AddEvidence("farcaster", "error", err.Error())
	} else {
		result.AddEvidence("farcaster", "cast_count", fmt.Sprintf("%d", len(casts)))

		if len(casts) > 0 {
			// Summarize top casts
			var castLines []string
			totalEngagement := 0
			for i, c := range casts {
				if i >= 10 {
					break
				}
				engagement := c.Reactions.Likes + c.Reactions.Recasts + c.Replies.Count
				totalEngagement += engagement
				castLines = append(castLines, fmt.Sprintf(
					"- @%s (%d followers): \"%s\" [likes:%d recasts:%d replies:%d]",
					c.Author.Username, c.Author.Followers,
					truncate(c.Text, 100), c.Reactions.Likes, c.Reactions.Recasts, c.Replies.Count,
				))
			}
			result.AddEvidence("farcaster", "total_engagement", fmt.Sprintf("%d", totalEngagement))
			farcasterSummary = fmt.Sprintf("Found %d Farcaster casts, total engagement: %d\n%s",
				len(casts), totalEngagement, strings.Join(castLines, "\n"))
		} else {
			farcasterSummary = "No Farcaster casts found for this token"
		}
	}

	// Step 2: Get token name from GoPlus data if available
	tokenName := token // fallback to address
	if ctx.GoPlusData != nil && ctx.GoPlusData.TokenName != "" {
		tokenName = ctx.GoPlusData.TokenName
		if ctx.GoPlusData.TokenSymbol != "" {
			tokenName += " ($" + ctx.GoPlusData.TokenSymbol + ")"
		}
	}

	// Step 3: Spawn Sonnet agent to do comprehensive social research
	prompt := fmt.Sprintf(`You are MUSASHI's Social Momentum analyst. Analyze the social presence and momentum of this token.

TOKEN: %s
ADDRESS: %s
CHAIN ID: %d
TOKEN AGE: %s

FARCASTER DATA (already collected):
%s

YOUR TASK: Search the web for social signals from MULTIPLE sources. You MUST use WebSearch to find data from:

1. Twitter/X - search for the token name and ticker. Check engagement, follower quality, bot vs organic
2. Reddit - search crypto subreddits (r/cryptocurrency, r/CryptoMoonShots, r/memecoins, r/defi) for mentions
3. Telegram - search for "site:t.me %s" to find Telegram groups/channels
4. DexScreener/DexTools - check if token has linked socials
5. Crypto forums/news - search for any mentions on crypto news sites, Medium, Mirror
6. YouTube/TikTok - search for video content about this token (indicator of retail interest)

For EACH source, note:
- How many mentions/posts found
- Quality of engagement (real users vs bots)
- Sentiment (bullish/bearish/neutral)
- Recency (are posts from today, this week, or old?)

OUTPUT FORMAT (strict):
SOCIAL MOMENTUM REPORT

STATUS: [PASS/WARN/FAIL]
SCORE: [1-10]

TWITTER: [findings or "no data"]
REDDIT: [findings or "no data"]
FARCASTER: [findings or "no data"]
TELEGRAM: [findings or "no data"]
OTHER SOURCES: [findings or "no data"]

BOT RATIO: [estimated %% of engagement that appears bot-driven]
ORGANIC SIGNAL: [STRONG/MODERATE/WEAK/NONE]

VERDICT: [1-2 sentence summary of social momentum]`, tokenName, token, chainID, ctx.Age, farcasterSummary, tokenName)

	result.AddEvidence("agent", "model", "sonnet")
	result.AddEvidence("agent", "sources", "farcaster,twitter,reddit,telegram,forums,youtube")

	agentResponse, err := agent.RunSonnet(prompt, 90*time.Second)
	if err != nil {
		result.AddEvidence("agent", "error", err.Error())
		// If agent fails, fall back to Farcaster-only analysis
		if len(casts) > 5 {
			return result.Warn("AI agent failed but Farcaster shows some activity — manual verification recommended"), nil
		}
		return result.Warn("AI agent failed and limited Farcaster data — social momentum unknown"), nil
	}

	// Parse agent verdict
	verdict := agent.ParseGateVerdict(agentResponse)
	result.AddEvidence("agent", "score", fmt.Sprintf("%d/10", verdict.Score))
	result.AddEvidence("agent", "report", truncate(verdict.Report, 2000))

	switch verdict.Status {
	case "PASS":
		return result.Pass(fmt.Sprintf("Social momentum is positive (score: %d/10)", verdict.Score)), nil
	case "FAIL":
		return result.Fail(fmt.Sprintf("Weak or suspicious social signals (score: %d/10)", verdict.Score)), nil
	default:
		return result.Warn(fmt.Sprintf("Social signals are mixed (score: %d/10) — agent recommends further investigation", verdict.Score)), nil
	}
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen] + "..."
}
