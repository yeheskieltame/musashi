package gates

import (
	"fmt"
	"strconv"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
)

// ContractSafetyGate implements Gate 1: Contract Safety.
// Uses GoPlus token_security (shared from pipeline context) + RPC checks.
type ContractSafetyGate struct{}

func NewContractSafetyGate() *ContractSafetyGate {
	return &ContractSafetyGate{}
}

func (g *ContractSafetyGate) Name() string   { return "Contract Safety" }
func (g *ContractSafetyGate) Number() int     { return 1 }

func (g *ContractSafetyGate) Evaluate(token string, chainID int64) (*Result, error) {
	return g.EvaluateWithContext(token, chainID, TokenContext{Age: AgeEstablished})
}

func (g *ContractSafetyGate) EvaluateWithContext(token string, chainID int64, ctx TokenContext) (*Result, error) {
	result := NewResult(g.Name(), g.Number())

	// Use shared GoPlus data from pipeline context to avoid redundant API calls
	var sec *data.TokenSecurityData
	var err error
	if ctx.GoPlusFetched {
		sec = ctx.GoPlusData
		err = ctx.GoPlusError
	} else {
		goplus := data.NewGoPlusClient()
		sec, err = goplus.GetTokenSecurity(chainID, token)
	}

	if err != nil {
		result.AddEvidence("goplus", "error", err.Error())
		return result.DataInsufficient(
			"GoPlus has no security data for this token — agent specialist must verify contract via block explorer",
			"is_honeypot", "is_mintable", "can_take_back_ownership", "is_open_source", "lp_lock_status", "deployer_prior_tokens",
		), nil
	}

	result.AddEvidence("goplus", "token_name", sec.TokenName)
	result.AddEvidence("goplus", "token_symbol", sec.TokenSymbol)

	// Instant kill checks (only fire on VERIFIED true, never on empty)
	if sec.IsHoneypot == "1" {
		result.AddEvidence("goplus", "is_honeypot", "true")
		return result.Fail("Honeypot detected — token cannot be sold"), nil
	}
	result.AddEvidence("goplus", "is_honeypot", sec.IsHoneypot)

	if sec.IsMintable == "1" {
		result.AddEvidence("goplus", "is_mintable", "true")
		return result.Fail("Mint authority not revoked — unlimited supply risk"), nil
	}
	result.AddEvidence("goplus", "is_mintable", sec.IsMintable)

	if sec.CanTakeBackOwnership == "1" {
		result.AddEvidence("goplus", "can_take_back_ownership", "true")
		return result.Fail("Owner can reclaim ownership — rug risk"), nil
	}

	// Gap detection — collect every critical field GoPlus left empty so the
	// safety specialist can chase them via Etherscan-family explorers. We do
	// NOT fail or pass on these here; they bubble up via result.Gaps and the
	// status is decided after collecting all gaps.
	criticalEmpty := []string{}
	if IsEmpty(sec.IsHoneypot) {
		criticalEmpty = append(criticalEmpty, "is_honeypot")
	}
	if IsEmpty(sec.IsMintable) {
		criticalEmpty = append(criticalEmpty, "is_mintable")
	}
	if IsEmpty(sec.CanTakeBackOwnership) {
		criticalEmpty = append(criticalEmpty, "can_take_back_ownership")
	}
	if IsEmpty(sec.IsOpenSource) {
		criticalEmpty = append(criticalEmpty, "is_open_source")
	}
	if IsEmpty(sec.BuyTax) || IsEmpty(sec.SellTax) {
		criticalEmpty = append(criticalEmpty, "tax_structure")
	}
	if len(sec.LPHolders) == 0 {
		criticalEmpty = append(criticalEmpty, "lp_holders")
	}

	// Track warnings for context-dependent checks
	var warnings []string

	if sec.IsBlacklisted == "1" {
		result.AddEvidence("goplus", "is_blacklisted", "true")
		warnings = append(warnings, "blacklist")
	}

	if sec.SlippageModifiable == "1" {
		result.AddEvidence("goplus", "slippage_modifiable", "true")
		warnings = append(warnings, "slippage_modifiable")
	}

	if sec.TransferPausable == "1" {
		result.AddEvidence("goplus", "transfer_pausable", "true")
		warnings = append(warnings, "transfer_pausable")
	}

	// Context-dependent: if warnings exist, check holder count to decide severity.
	// High holder count (>10K) = established token, likely compliance feature → WARN
	// Low holder count (<10K) = new/small token, likely rug vector → FAIL
	if len(warnings) > 0 {
		holderCount, _ := strconv.Atoi(sec.HolderCount)
		result.AddEvidence("analysis", "risk_flags", fmt.Sprintf("%v", warnings))

		if holderCount < 10000 {
			return result.Fail(fmt.Sprintf("Contract has %v with only %d holders — high risk for small token", warnings, holderCount)), nil
		}

		// Multiple warnings on any token = FAIL regardless
		if len(warnings) >= 2 {
			return result.Fail(fmt.Sprintf("Contract has multiple risk flags: %v", warnings)), nil
		}

		// Single warning + high holders = WARN (agent investigates further)
		result.AddEvidence("analysis", "context", fmt.Sprintf("%s detected but token has %d holders — likely compliance, not malicious", warnings[0], holderCount))
	}

	// Tax check: sell tax > buy tax + 3% is suspicious
	buyTax, _ := strconv.ParseFloat(sec.BuyTax, 64)
	sellTax, _ := strconv.ParseFloat(sec.SellTax, 64)
	result.AddEvidence("goplus", "buy_tax", fmt.Sprintf("%.2f%%", buyTax*100))
	result.AddEvidence("goplus", "sell_tax", fmt.Sprintf("%.2f%%", sellTax*100))

	if sellTax > 0.05 {
		return result.Fail(fmt.Sprintf("Sell tax too high: %.1f%%", sellTax*100)), nil
	}

	if sellTax > buyTax+0.03 {
		return result.Fail(fmt.Sprintf("Asymmetric tax: buy %.1f%% vs sell %.1f%%", buyTax*100, sellTax*100)), nil
	}

	// Proxy check (warning, not instant fail)
	if sec.IsProxy == "1" {
		result.AddEvidence("goplus", "is_proxy", "true")
		if sec.IsOpenSource != "1" {
			return result.Fail("Upgradeable proxy contract with non-open-source code"), nil
		}
		result.AddEvidence("goplus", "proxy_warning", "upgradeable but open source")
	}

	// Open source check (warning)
	result.AddEvidence("goplus", "is_open_source", sec.IsOpenSource)
	result.AddEvidence("goplus", "owner_address", sec.OwnerAddress)
	result.AddEvidence("goplus", "creator_address", sec.CreatorAddress)
	result.AddEvidence("goplus", "holder_count", sec.HolderCount)

	// If GoPlus left a substantial number of critical fields empty, escalate
	// to DATA_INSUFFICIENT so the specialist runs the fallback playbook
	// (Etherscan-family getsourcecode + creator address history) before the
	// judge even sees this report. Threshold: 3+ empty critical fields.
	if len(criticalEmpty) >= 3 {
		return result.DataInsufficient(
			fmt.Sprintf("GoPlus left %d critical safety fields empty — specialist must verify via block explorer", len(criticalEmpty)),
			criticalEmpty...,
		), nil
	}

	// Smaller gap count: still pass/warn but record the gaps for the specialist.
	for _, g := range criticalEmpty {
		result.AddGap(g)
	}

	if len(warnings) > 0 {
		return result.Warn(fmt.Sprintf("Contract has %v — flagged but likely safe (high holder count)", warnings)), nil
	}

	return result.Pass("Contract passes all safety checks"), nil
}
