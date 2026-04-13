package gates

import (
	"encoding/json"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// Status represents a gate's pass/fail status.
type Status string

const (
	StatusPass             Status = "PASS"
	StatusFail             Status = "FAIL"
	StatusWarn             Status = "WARN"
	StatusSkip             Status = "SKIP"
	StatusDataInsufficient Status = "DATA_INSUFFICIENT"
)

// IsEmpty reports whether a string field returned by an upstream API should be
// treated as "not analyzed yet" rather than "verified false". GoPlus returns
// "1" for true, "0" for false, and "" for fields it has not yet scanned. The
// empty case must NOT silently pass through as a negative — it is a data gap
// the agent specialist needs to fill via fallback investigation.
func IsEmpty(s string) bool {
	return s == "" || s == "null"
}

// TokenAge represents the maturity stage of a token.
//
// Tier model is data-backed (ChainPlay pump.fun survival study, Gate Research
// memecoin lifecycle, Onchain.org launch data):
//   - Fresh <24h: 15% die in first 24h; survivors exponential
//   - Early 1-7d: 31% mortality by day 7; discovery dominant
//   - Discovery 7-30d: inflection point — tokens can still enter accumulation
//   - Maturation 30-90d: survival curve flattens; flat holders = reliable dead signal
//   - Established >90d: 98% of memecoins dead by 90d; strict filtering
//
// Chain-specific multipliers are applied in ClassifyAgeForChain:
//   - Solana/pump.fun launches: ×0.7 (compressed timeline — 7/21/60d effective)
//   - ETH/L2 fair launches: ×1.0 (default 7/30/90)
//   - BSC: ×0.85 (between the two — 7/25/75 effective)
type TokenAge string

const (
	AgeFresh       TokenAge = "fresh"       // < 24 hours
	AgeEarly       TokenAge = "early"       // 1-7 days
	AgeDiscovery   TokenAge = "discovery"   // 7-30 days
	AgeMaturation  TokenAge = "maturation"  // 30-90 days
	AgeEstablished TokenAge = "established" // > 90 days
)

// TokenContext carries metadata about the token that gates can use for tiered evaluation.
type TokenContext struct {
	Age            TokenAge      // Token maturity stage
	AgeHours       float64       // Exact age in hours
	PairCreatedAt  time.Time     // When the primary pair was created
	HasAgeData     bool          // Whether we have reliable age data
	// Shared data: fetched once in pipeline, reused across gates to avoid rate limits
	GoPlusData     *data.TokenSecurityData // Cached GoPlus result (nil if fetch failed)
	GoPlusError    error                   // Error from GoPlus fetch (nil if success)
	GoPlusFetched  bool                    // Whether GoPlus was already fetched

	// Cached CoinGecko data: shared between Gate 4 (Social) and Gate 5 (Narrative)
	CoinGeckoDetail  *data.CoinDetail // Cached coin detail (nil if not fetched)
	CoinGeckoID      string           // Resolved CoinGecko coin ID
	CoinGeckoFetched bool             // Whether CoinGecko was already fetched

	// Cached DexScreener pairs: fetched once for age detection, reused by
	// liquidity/social/narrative gates so we don't burn rate limit hitting
	// the same /tokens/{address} endpoint repeatedly.
	DexPairs        []data.DexPair
	DexPairsFetched bool

	// Pre-fetched typed boost list (small payload, single call) so social and
	// narrative gates can compute boost-to-organic ratios without each gate
	// calling /token-boosts/latest/v1 individually.
	BoostedTokens        []data.BoostedToken
	BoostedTokensFetched bool

	// Narrative landscape: top CoinGecko categories ranked by 24h market cap
	// gain. Lets the narrative gate score "is this token in a rising sector"
	// instead of relying solely on a static keyword list.
	NarrativeLandscape        []data.CoinCategory
	NarrativeLandscapeFetched bool
}

// chainAgeMultiplier returns a speed factor for the age-tier classifier based
// on launchpad dynamics. Solana (pump.fun) compresses the timeline ~3x;
// BSC sits between; ETH/L2 is the 1.0 baseline the research was calibrated on.
func chainAgeMultiplier(chainID int64) float64 {
	switch chainID {
	case 101, 900, 8453 * 1000: // Solana sentinel IDs used in some registries
		return 0.7
	case 56: // BSC
		return 0.85
	default: // Ethereum (1), Arbitrum (42161), Base (8453), Polygon (137), 0G (16661), etc.
		return 1.0
	}
}

// ClassifyAge determines the token's age tier from pairCreatedAt timestamp
// (milliseconds). Uses default ETH/L2 multipliers. For chain-aware classification
// use ClassifyAgeForChain.
func ClassifyAge(pairCreatedAtMs int64) TokenContext {
	return ClassifyAgeForChain(pairCreatedAtMs, 1)
}

// ClassifyAgeForChain applies chain-specific multipliers to the age tier cutoffs.
// Reference cutoffs (ETH/L2 baseline): 24h / 7d / 30d / 90d.
func ClassifyAgeForChain(pairCreatedAtMs int64, chainID int64) TokenContext {
	if pairCreatedAtMs == 0 {
		return TokenContext{Age: AgeEstablished, HasAgeData: false}
	}
	created := time.UnixMilli(pairCreatedAtMs)
	age := time.Since(created)
	hours := age.Hours()

	ctx := TokenContext{
		PairCreatedAt: created,
		AgeHours:      hours,
		HasAgeData:    true,
	}

	mult := chainAgeMultiplier(chainID)
	freshCutoff := 24.0 * mult
	earlyCutoff := 24.0 * 7 * mult
	discoveryCutoff := 24.0 * 30 * mult
	maturationCutoff := 24.0 * 90 * mult

	switch {
	case hours < freshCutoff:
		ctx.Age = AgeFresh
	case hours < earlyCutoff:
		ctx.Age = AgeEarly
	case hours < discoveryCutoff:
		ctx.Age = AgeDiscovery
	case hours < maturationCutoff:
		ctx.Age = AgeMaturation
	default:
		ctx.Age = AgeEstablished
	}
	return ctx
}

// Evidence represents a single piece of evidence collected during gate evaluation.
type Evidence struct {
	Source string `json:"source"`
	Key    string `json:"key"`
	Value  string `json:"value"`
}

// Result is the output of a single gate evaluation.
type Result struct {
	Gate     string     `json:"gate"`
	GateNum  int        `json:"gate_num"`
	Status   Status     `json:"status"`
	Reason   string     `json:"reason"`
	Evidence []Evidence `json:"evidence"`
	// Gaps lists field names the agent specialist must investigate via
	// fallback sources (block explorers, Nitter, DeFiLlama, etc). Populated
	// whenever the gate could not verify a critical field from primary APIs.
	Gaps []string `json:"gaps,omitempty"`
}

// Gate is the interface all gates must implement.
type Gate interface {
	Name() string
	Number() int
	Evaluate(token string, chainID int64) (*Result, error)
}

// AgeAwareGate is a gate that adjusts thresholds based on token maturity.
type AgeAwareGate interface {
	Gate
	EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error)
}

// JSON serializes the result.
func (r *Result) JSON() string {
	b, _ := json.MarshalIndent(r, "", "  ")
	return string(b)
}

// NewResult creates a result with defaults.
func NewResult(gate string, num int) *Result {
	return &Result{
		Gate:     gate,
		GateNum:  num,
		Evidence: []Evidence{},
	}
}

// Pass marks the result as passed.
func (r *Result) Pass(reason string) *Result {
	r.Status = StatusPass
	r.Reason = reason
	return r
}

// Fail marks the result as failed.
func (r *Result) Fail(reason string) *Result {
	r.Status = StatusFail
	r.Reason = reason
	return r
}

// Warn marks the result as warning.
func (r *Result) Warn(reason string) *Result {
	r.Status = StatusWarn
	r.Reason = reason
	return r
}

// DataInsufficient marks the result as needing agent gap-fill investigation.
// The gaps slice should list the specific field names the specialist must
// chase via fallback sources. This status is NOT a fail — it tells the judge
// "data is missing, ask the user whether to dig deeper."
func (r *Result) DataInsufficient(reason string, gaps ...string) *Result {
	r.Status = StatusDataInsufficient
	r.Reason = reason
	r.Gaps = append(r.Gaps, gaps...)
	return r
}

// AddGap appends a single field name to the gap list without changing status.
// Useful when a gate passes overall but had to fall back for one optional field.
func (r *Result) AddGap(field string) *Result {
	r.Gaps = append(r.Gaps, field)
	return r
}

// AddEvidence appends evidence to the result.
func (r *Result) AddEvidence(source, key, value string) {
	r.Evidence = append(r.Evidence, Evidence{
		Source: source,
		Key:    key,
		Value:  value,
	})
}
