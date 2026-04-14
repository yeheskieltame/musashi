package pipeline

import (
	"encoding/json"
	"fmt"
	"sort"
	"strings"
	"time"


	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/gates"
)

// PipelineResult holds the results of all gate evaluations.
//
// Status values:
//   - PASS              — every gate passed cleanly (or only WARN with sufficient data)
//   - FAIL              — at least one gate returned a verified-true kill (honeypot, mintable, etc.)
//   - DATA_INSUFFICIENT — gates that need agent gap-fill before judging conviction
//   - WARN              — soft flags only; conviction debate still proceeds
//
// The runner is NOT fail-fast except for verified Gate 1 kills. All other
// gates run regardless so the agent gets the complete picture in one shot.
type PipelineResult struct {
	Token     string          `json:"token"`
	ChainID   int64           `json:"chain_id"`
	Timestamp string          `json:"timestamp"`
	Status    string          `json:"status"`
	FailedAt  int             `json:"failed_at,omitempty"`
	TokenAge  string          `json:"token_age,omitempty"`
	AgeHours  float64         `json:"age_hours,omitempty"`
	Gates     []*gates.Result `json:"gates"`
	// Gaps aggregates every gap from every gate, deduplicated. The agent
	// specialists chase these via fallback sources (block explorers,
	// Nitter, DefiLlama, etc.) before submitting their reports.
	Gaps []string `json:"gaps,omitempty"`
}

// JSON serializes the pipeline result.
func (p *PipelineResult) JSON() string {
	b, _ := json.MarshalIndent(p, "", "  ")
	return string(b)
}

// Pretty returns a human-readable summary.
func (p *PipelineResult) Pretty() string {
	var sb strings.Builder

	sb.WriteString(fmt.Sprintf("\n武蔵 MUSASHI — Gate Pipeline Results\n"))
	sb.WriteString(fmt.Sprintf("Token: %s | Chain: %d\n", p.Token, p.ChainID))
	if p.TokenAge != "" {
		sb.WriteString(fmt.Sprintf("Age:   %s (%.1f hours)\n", p.TokenAge, p.AgeHours))
	}
	sb.WriteString(fmt.Sprintf("Time:  %s\n", p.Timestamp))
	sb.WriteString(strings.Repeat("─", 60) + "\n")

	for _, g := range p.Gates {
		icon := "✓"
		switch g.Status {
		case gates.StatusFail:
			icon = "✗"
		case gates.StatusWarn:
			icon = "⚠"
		case gates.StatusSkip:
			icon = "○"
		case gates.StatusDataInsufficient:
			icon = "?"
		}

		sb.WriteString(fmt.Sprintf("[%s] Gate %d: %s — %s\n", icon, g.GateNum, g.Gate, g.Status))
		if g.Reason != "" {
			sb.WriteString(fmt.Sprintf("    %s\n", g.Reason))
		}
		if len(g.Gaps) > 0 {
			sb.WriteString(fmt.Sprintf("    gaps: %s\n", strings.Join(g.Gaps, ", ")))
		}
	}

	sb.WriteString(strings.Repeat("─", 60) + "\n")
	sb.WriteString(fmt.Sprintf("Result: %s\n", p.Status))

	if p.Status == "FAIL" && p.FailedAt > 0 {
		sb.WriteString(fmt.Sprintf("Failed at Gate %d — pipeline stopped.\n", p.FailedAt))
	}

	if len(p.Gaps) > 0 {
		sb.WriteString("\nDATA GAPS — specialists must investigate before judging:\n")
		for _, gap := range p.Gaps {
			sb.WriteString(fmt.Sprintf("  - %s\n", gap))
		}
	}

	return sb.String()
}

// fetchTokenAgeAndPairs fetches DexScreener pairs once and derives age + caches
// the full pair list so downstream gates don't have to refetch.
func fetchTokenAgeAndPairs(token string, chainID int64) gates.TokenContext {
	dex := data.NewDexScreenerClient()
	dexData, err := dex.GetTokenPairs(token)
	if err != nil || dexData == nil || len(dexData.Pairs) == 0 {
		return gates.TokenContext{Age: gates.AgeEstablished, HasAgeData: false}
	}

	// Find the earliest pair creation time (oldest pair = token age)
	var earliestMs int64
	for _, p := range dexData.Pairs {
		if p.PairCreatedAt > 0 && (earliestMs == 0 || p.PairCreatedAt < earliestMs) {
			earliestMs = p.PairCreatedAt
		}
	}

	ctx := gates.ClassifyAgeForChain(earliestMs, chainID)
	ctx.DexPairs = dexData.Pairs
	ctx.DexPairsFetched = true
	return ctx
}

// RunGates executes the gate pipeline sequentially with fail-fast behavior.
// Gates 4 (social) and 5 (narrative) are agent-driven.
// When skipAI is true, Gates 4-5 are marked SKIP (useful for fast quantitative screening).
// Token age is automatically detected and used for tiered thresholds.
// GoPlus data is fetched ONCE and shared across all gates to avoid rate limits.
func RunGates(token string, chainID int64, skipAI ...bool) (*PipelineResult, error) {
	shouldSkipAI := len(skipAI) > 0 && skipAI[0]
	// Fetch token age + dexscreener pair list once for the whole pipeline
	tokenCtx := fetchTokenAgeAndPairs(token, chainID)

	// Fetch GoPlus data once and cache in context — Gates 1, 2, 3 all need it.
	// This prevents 3x redundant API calls which trigger 429 rate limits.
	goplus := data.NewGoPlusClient()
	sec, err := goplus.GetTokenSecurity(chainID, token)
	tokenCtx.GoPlusFetched = true
	tokenCtx.GoPlusData = sec
	tokenCtx.GoPlusError = err

	// Pre-fetch CoinGecko data for Gates 4-5 (Social + Narrative share it).
	// This avoids duplicate searches that would hit CoinGecko rate limits.
	//
	// Resolution order (IMPORTANT — do not regress to symbol-first search):
	//   1. Contract-address lookup via /coins/{platform}/contract/{address}.
	//      This is the ONLY reliable way to disambiguate tokens that share a
	//      symbol across chains. Real bug caught during 0G Labs analysis:
	//      symbol "0G" exists as an L1 infra token on BSC AND as unrelated
	//      memecoins on Solana — symbol search returned the Solana token
	//      and classified 0G as "Solana Memecoin" (completely wrong).
	//   2. Symbol search fallback ONLY when the chain isn't indexed by
	//      CoinGecko or the contract isn't listed yet. Still a lossy path
	//      but better than nothing for obscure chains.
	if !shouldSkipAI {
		cg := data.NewCoinGeckoClient()
		var detail *data.CoinDetail

		// Path 1: contract lookup (preferred, always try first)
		if platform := data.ChainIDToCoinGeckoPlatform(chainID); platform != "" {
			if d, err := cg.GetCoinByContract(platform, token); err == nil && d != nil {
				detail = d
				tokenCtx.CoinGeckoID = d.ID
			}
		}

		// Path 2: symbol search fallback
		if detail == nil {
			searchTerm := ""
			if sec != nil && sec.TokenSymbol != "" {
				searchTerm = sec.TokenSymbol
			} else if sec != nil && sec.TokenName != "" {
				searchTerm = sec.TokenName
			}
			if searchTerm != "" {
				searchResult, searchErr := cg.SearchCoins(searchTerm)
				if searchErr == nil && len(searchResult.Coins) > 0 {
					// Find best match (prefer exact symbol match)
					coinID := searchResult.Coins[0].ID
					if sec != nil {
						for _, coin := range searchResult.Coins {
							if strings.EqualFold(coin.Symbol, sec.TokenSymbol) {
								coinID = coin.ID
								break
							}
						}
					}
					tokenCtx.CoinGeckoID = coinID
					if d, detailErr := cg.GetCoinDetail(coinID); detailErr == nil {
						detail = d
					}
				}
			}
		}

		if detail != nil {
			tokenCtx.CoinGeckoDetail = detail
		}
		tokenCtx.CoinGeckoFetched = true

		// Pre-fetch narrative landscape: top categories ranked by 24h gain.
		// Single CoinGecko call shared between social and narrative gates.
		cgCat := data.NewCoinGeckoClient()
		if cats, catErr := cgCat.GetCategories(); catErr == nil {
			tokenCtx.NarrativeLandscape = cats
			tokenCtx.NarrativeLandscapeFetched = true
		}

		// Pre-fetch boost list — small payload, single call. Reused by
		// social (boost-to-organic ratio) and narrative (manufactured hype
		// detection) gates.
		dexBoost := data.NewDexScreenerClient()
		if boosts, boostErr := dexBoost.GetBoostedTokens(); boostErr == nil {
			tokenCtx.BoostedTokens = boosts
			tokenCtx.BoostedTokensFetched = true
		}
	}

	result := &PipelineResult{
		Token:     token,
		ChainID:   chainID,
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Status:    "PASS",
		Gates:     make([]*gates.Result, 0),
	}

	if tokenCtx.HasAgeData {
		result.TokenAge = string(tokenCtx.Age)
		result.AgeHours = tokenCtx.AgeHours
	}

	// Define gate sequence: all 7 gates.
	// Gates 4 and 5 are AI-powered (Sonnet agent with WebSearch).
	gateList := []gates.Gate{
		gates.NewContractSafetyGate(),  // Gate 1 (age-aware, shared GoPlus)
		gates.NewLiquidityGate(),       // Gate 2 (age-aware, shared GoPlus)
		gates.NewWalletsGate(),         // Gate 3 (age-aware, shared GoPlus)
		gates.NewSocialGate(),          // Gate 4 (AI-powered: Farcaster + WebSearch)
		gates.NewNarrativeGate(),       // Gate 5 (AI-powered: WebSearch narrative analysis)
		gates.NewTimingGate(),          // Gate 6
		gates.NewCrossValidationGate(), // Gate 7
	}

	// Collect-all execution: every gate runs and produces a result, even if
	// earlier gates returned FAIL or DATA_INSUFFICIENT. The only exception is
	// a verified Gate 1 honeypot kill — once that's confirmed there's nothing
	// for downstream gates to add, so we abort early to save API calls.
	gapSet := map[string]struct{}{}
	hasFail := false
	hasDataInsufficient := false
	hasWarn := false

	for _, gate := range gateList {
		var gateResult *gates.Result
		var err error

		// Skip AI-powered gates (4, 5) when requested — they'll be handled
		// by the debate route's specialist agents instead.
		if shouldSkipAI && (gate.Number() == 4 || gate.Number() == 5) {
			gateResult = gates.NewResult(gate.Name(), gate.Number())
			gateResult.Status = gates.StatusSkip
			gateResult.Reason = "Skipped (AI gates run during debate)"
			result.Gates = append(result.Gates, gateResult)
			continue
		}

		// Use age-aware evaluation for gates that support it
		if ageGate, ok := gate.(gates.AgeAwareGate); ok {
			gateResult, err = ageGate.EvaluateWithContext(token, chainID, tokenCtx)
		} else {
			gateResult, err = gate.Evaluate(token, chainID)
		}

		if err != nil {
			// Gate hit an unexpected error (all retries exhausted, network
			// blip, etc.). Treat as DATA_INSUFFICIENT so the specialist
			// knows to retry the lookup themselves.
			gateResult = gates.NewResult(gate.Name(), gate.Number())
			gateResult.Status = gates.StatusDataInsufficient
			gateResult.Reason = fmt.Sprintf("gate error: %v", err)
		}

		result.Gates = append(result.Gates, gateResult)

		// Aggregate gaps for the pipeline-level summary
		for _, gap := range gateResult.Gaps {
			tag := fmt.Sprintf("gate%d:%s", gate.Number(), gap)
			gapSet[tag] = struct{}{}
		}

		switch gateResult.Status {
		case gates.StatusFail:
			hasFail = true
			if result.FailedAt == 0 {
				result.FailedAt = gate.Number()
			}
			// Verified Gate 1 honeypot kill: abort the pipeline. Downstream
			// gates have nothing to add when the contract is provably evil.
			if gate.Number() == 1 {
				result.Status = "FAIL"
				result.Gaps = flattenGapSet(gapSet)
				return result, nil
			}
		case gates.StatusDataInsufficient:
			hasDataInsufficient = true
		case gates.StatusWarn:
			hasWarn = true
		}
	}

	// Final status precedence: FAIL > DATA_INSUFFICIENT > WARN > PASS.
	// FAIL means at least one gate verified a kill condition.
	// DATA_INSUFFICIENT means specialists must investigate before the judge can rule.
	// WARN means soft flags only; conviction debate proceeds.
	switch {
	case hasFail:
		result.Status = "FAIL"
	case hasDataInsufficient:
		result.Status = "DATA_INSUFFICIENT"
	case hasWarn:
		result.Status = "WARN"
	}

	result.Gaps = flattenGapSet(gapSet)
	return result, nil
}

// flattenGapSet returns a deterministic, sorted slice of gap tags.
func flattenGapSet(set map[string]struct{}) []string {
	out := make([]string, 0, len(set))
	for k := range set {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
