package gates

import (
	"fmt"
	"strings"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/agent"
)

// NarrativeGate implements Gate 5: Narrative Alignment.
// Uses AI agent (Sonnet) with WebSearch to assess whether the token's
// narrative is well-positioned in current market meta.
type NarrativeGate struct{}

func NewNarrativeGate() *NarrativeGate {
	return &NarrativeGate{}
}

func (g *NarrativeGate) Name() string { return "Narrative Alignment" }
func (g *NarrativeGate) Number() int  { return 5 }

func (g *NarrativeGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

func (g *NarrativeGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	// Get token name from GoPlus data if available
	tokenName := token
	tokenSymbol := ""
	if ctx.GoPlusData != nil {
		if ctx.GoPlusData.TokenName != "" {
			tokenName = ctx.GoPlusData.TokenName
		}
		if ctx.GoPlusData.TokenSymbol != "" {
			tokenSymbol = ctx.GoPlusData.TokenSymbol
		}
	}

	prompt := fmt.Sprintf(`You are MUSASHI's Narrative Alignment analyst. Assess whether this token's narrative is well-positioned in the current market meta.

TOKEN: %s
SYMBOL: %s
ADDRESS: %s
CHAIN ID: %d
TOKEN AGE: %s

YOUR TASK: Research this token's narrative positioning. You MUST use WebSearch to answer:

1. NARRATIVE IDENTIFICATION
   - What narrative/meta does this token belong to? (AI, meme, DePIN, RWA, gaming, L2, etc.)
   - Is it a copycat of another successful token?
   - Search for "top trending crypto narratives 2026" to see what's hot right now

2. LIFECYCLE STAGE
   - FORMING: New narrative, few tokens, early believers only
   - GROWING: Narrative gaining traction, KOLs picking up, increasing attention
   - PEAK: Everyone talking about it, mainstream coverage, likely too late
   - DECLINING: Narrative losing steam, attention shifting elsewhere
   - Search for similar tokens in the same narrative to assess lifecycle

3. CATALYST ANALYSIS
   - Are there upcoming events, launches, partnerships, or announcements?
   - Search for recent news about this token
   - Check if the narrative has momentum (new projects launching in same space)

4. COPYCAT DETECTION
   - Search for tokens with similar names/themes
   - If >5 similar tokens exist, the narrative is likely peaked
   - Original narratives score higher than copies

5. MEME QUALITY (if meme token)
   - Is the meme culturally relevant?
   - Does it have staying power or is it a flash trend?
   - Search for the meme origin and community

OUTPUT FORMAT (strict):
NARRATIVE ALIGNMENT REPORT

STATUS: [PASS/WARN/FAIL]
SCORE: [1-10]

NARRATIVE: [identified narrative/meta]
LIFECYCLE: [FORMING/GROWING/PEAK/DECLINING]
COPYCAT COUNT: [number of similar tokens found]

CATALYSTS:
- [list upcoming events/triggers, or "none found"]

NARRATIVE FIT: [how well this token fits the current market meta]
TIMING: [is now a good time for this narrative?]

VERDICT: [1-2 sentence summary]`, tokenName, tokenSymbol, token, chainID, ctx.Age)

	result.AddEvidence("agent", "model", "sonnet")
	result.AddEvidence("agent", "analysis", "narrative_lifecycle_catalysts_copycats")

	agentResponse, err := agent.RunSonnet(prompt, 90*time.Second)
	if err != nil {
		result.AddEvidence("agent", "error", err.Error())
		return result.Warn("AI agent failed — narrative alignment unknown, agent should verify manually"), nil
	}

	verdict := agent.ParseGateVerdict(agentResponse)
	result.AddEvidence("agent", "score", fmt.Sprintf("%d/10", verdict.Score))
	result.AddEvidence("agent", "report", truncate(verdict.Report, 2000))

	// Also check lifecycle for status override
	reportUpper := strings.ToUpper(verdict.Report)
	if strings.Contains(reportUpper, "LIFECYCLE: DECLINING") || strings.Contains(reportUpper, "LIFECYCLE: PEAK") {
		if verdict.Status == "PASS" {
			verdict.Status = "WARN"
		}
	}
	if strings.Contains(reportUpper, "LIFECYCLE: FORMING") && verdict.Score >= 5 {
		verdict.Status = "PASS"
	}

	switch verdict.Status {
	case "PASS":
		return result.Pass(fmt.Sprintf("Narrative is well-aligned with current market meta (score: %d/10)", verdict.Score)), nil
	case "FAIL":
		return result.Fail(fmt.Sprintf("Narrative is weak, declining, or oversaturated (score: %d/10)", verdict.Score)), nil
	default:
		return result.Warn(fmt.Sprintf("Narrative alignment is uncertain (score: %d/10) — timing may not be ideal", verdict.Score)), nil
	}
}
