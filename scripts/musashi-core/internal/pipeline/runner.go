package pipeline

import (
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/gates"
)

// PipelineResult holds the results of all gate evaluations.
type PipelineResult struct {
	Token     string          `json:"token"`
	ChainID   int64           `json:"chain_id"`
	Timestamp string          `json:"timestamp"`
	Status    string          `json:"status"` // PASS, FAIL, WARN
	FailedAt  int             `json:"failed_at,omitempty"`
	TokenAge  string          `json:"token_age,omitempty"`
	AgeHours  float64         `json:"age_hours,omitempty"`
	Gates     []*gates.Result `json:"gates"`
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
		}

		sb.WriteString(fmt.Sprintf("[%s] Gate %d: %s — %s\n", icon, g.GateNum, g.Gate, g.Status))
		if g.Reason != "" {
			sb.WriteString(fmt.Sprintf("    %s\n", g.Reason))
		}
	}

	sb.WriteString(strings.Repeat("─", 60) + "\n")
	sb.WriteString(fmt.Sprintf("Result: %s\n", p.Status))

	if p.Status == "FAIL" && p.FailedAt > 0 {
		sb.WriteString(fmt.Sprintf("Failed at Gate %d — pipeline stopped.\n", p.FailedAt))
	}

	return sb.String()
}

// fetchTokenAge gets the earliest pairCreatedAt from DexScreener data.
func fetchTokenAge(token string) gates.TokenContext {
	dex := data.NewDexScreenerClient()
	dexData, err := dex.GetTokenPairs(token)
	if err != nil || len(dexData.Pairs) == 0 {
		return gates.TokenContext{Age: gates.AgeEstablished, HasAgeData: false}
	}

	// Find the earliest pair creation time (oldest pair = token age)
	var earliestMs int64
	for _, p := range dexData.Pairs {
		if p.PairCreatedAt > 0 && (earliestMs == 0 || p.PairCreatedAt < earliestMs) {
			earliestMs = p.PairCreatedAt
		}
	}

	return gates.ClassifyAge(earliestMs)
}

// RunGates executes the gate pipeline sequentially with fail-fast behavior.
// Gates 4 (social) and 5 (narrative) are agent-driven and skipped here.
// Token age is automatically detected and used for tiered thresholds.
// GoPlus data is fetched ONCE and shared across all gates to avoid rate limits.
func RunGates(token string, chainID int64) (*PipelineResult, error) {
	// Fetch token age context first
	tokenCtx := fetchTokenAge(token)

	// Fetch GoPlus data once and cache in context — Gates 1, 2, 3 all need it.
	// This prevents 3x redundant API calls which trigger 429 rate limits.
	goplus := data.NewGoPlusClient()
	sec, err := goplus.GetTokenSecurity(chainID, token)
	tokenCtx.GoPlusFetched = true
	tokenCtx.GoPlusData = sec
	tokenCtx.GoPlusError = err

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

	// Define gate sequence: 1, 2, 3, [4-5 agent], 6, 7
	gateList := []gates.Gate{
		gates.NewContractSafetyGate(),  // Gate 1
		gates.NewLiquidityGate(),       // Gate 2 (age-aware)
		gates.NewWalletsGate(),         // Gate 3 (age-aware)
		// Gate 4 (Social) — agent-driven, skip
		// Gate 5 (Narrative) — agent-driven, skip
		gates.NewTimingGate(),          // Gate 6
		gates.NewCrossValidationGate(), // Gate 7
	}

	for _, gate := range gateList {
		var gateResult *gates.Result
		var err error

		// Use age-aware evaluation for gates that support it
		if ageGate, ok := gate.(gates.AgeAwareGate); ok {
			gateResult, err = ageGate.EvaluateWithContext(token, chainID, tokenCtx)
		} else {
			gateResult, err = gate.Evaluate(token, chainID)
		}

		if err != nil {
			// Gate encountered an unexpected error (e.g. all API retries exhausted).
			// Record it as a SKIP rather than aborting the entire pipeline, so
			// remaining gates can still provide signal.
			gateResult = gates.NewResult(gate.Name(), gate.Number())
			gateResult.Status = gates.StatusSkip
			gateResult.Reason = fmt.Sprintf("gate error: %v", err)
		}

		result.Gates = append(result.Gates, gateResult)

		// Fail-fast: stop pipeline on first failure
		if gateResult.Status == gates.StatusFail {
			result.Status = "FAIL"
			result.FailedAt = gate.Number()
			return result, nil
		}

		// Track warnings
		if gateResult.Status == gates.StatusWarn && result.Status != "FAIL" {
			result.Status = "WARN"
		}
	}

	return result, nil
}
