package pipeline

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/gates"
)

// DiscoveryResult holds discovered tokens.
type DiscoveryResult struct {
	Chain  int64             `json:"chain_id"`
	Tokens []DiscoveredToken `json:"tokens"`
}

type DiscoveredToken struct {
	Address        string  `json:"address"`
	Name           string  `json:"name"`
	Symbol         string  `json:"symbol"`
	PriceUsd       string  `json:"price_usd"`
	Volume24h      float64 `json:"volume_24h"`
	Liquidity      float64 `json:"liquidity_usd"`
	Source         string  `json:"source"`
	TokenAge       string  `json:"token_age,omitempty"`
	AgeHours       float64 `json:"age_hours,omitempty"`
	DeployerAddr   string  `json:"deployer_address,omitempty"`
	DeployerRisk   string  `json:"deployer_risk,omitempty"`
	IsHoneypot     bool    `json:"is_honeypot,omitempty"`
	IsMintable     bool    `json:"is_mintable,omitempty"`
	HolderCount    string  `json:"holder_count,omitempty"`
	QuickVerdict   string  `json:"quick_verdict,omitempty"`
}

// DiscoverTokens scans for new tokens using GeckoTerminal, DexScreener, and
// performs quick safety pre-screening (deployer check + honeypot check).
func DiscoverTokens(chainID int64, limit int) (string, error) {
	result := &DiscoveryResult{
		Chain:  chainID,
		Tokens: make([]DiscoveredToken, 0),
	}

	network := data.ChainIDToNetwork(chainID)
	gecko := data.NewGeckoTerminalClient()
	dex := data.NewDexScreenerClient()

	// Source 1: New pools on the chain
	newPools, err := gecko.GetNewPools(network)
	if err == nil {
		for _, pool := range newPools {
			if len(result.Tokens) >= limit*2 { // fetch extra, we'll filter
				break
			}
			result.Tokens = append(result.Tokens, DiscoveredToken{
				Address:   pool.Attributes.Address,
				Name:      pool.Attributes.Name,
				PriceUsd:  pool.Attributes.BaseTokenPrice,
				Liquidity: parseFloat(pool.Attributes.ReserveUsd),
				Source:    "geckoterminal_new_pools",
			})
		}
	}

	// Source 2: Trending pools
	if len(result.Tokens) < limit*2 {
		trending, err := gecko.GetTrendingPools()
		if err == nil {
			for _, pool := range trending {
				if len(result.Tokens) >= limit*2 {
					break
				}
				result.Tokens = append(result.Tokens, DiscoveredToken{
					Address:   pool.Attributes.Address,
					Name:      pool.Attributes.Name,
					PriceUsd:  pool.Attributes.BaseTokenPrice,
					Liquidity: parseFloat(pool.Attributes.ReserveUsd),
					Source:    "geckoterminal_trending",
				})
			}
		}
	}

	// Source 3: DexScreener boosted tokens (paid promotion = awareness signal)
	boosted, err := dex.GetBoostedTokens()
	if err == nil && len(result.Tokens) < limit*2 {
		for _, bt := range boosted {
			if len(result.Tokens) >= limit*2 {
				break
			}
			if bt.TokenAddress == "" {
				continue
			}
			result.Tokens = append(result.Tokens, DiscoveredToken{
				Address: bt.TokenAddress,
				Name:    bt.Description,
				Source:  "dexscreener_boosted",
			})
		}
	}

	// Enrich discovered tokens with safety pre-screening
	goplus := data.NewGoPlusClient()
	enriched := make([]DiscoveredToken, 0, limit)

	for i := range result.Tokens {
		token := &result.Tokens[i]

		// Skip tokens with zero address
		if token.Address == "" || token.Address == "0x0000000000000000000000000000000000000000" {
			continue
		}

		// Quick safety check via GoPlus
		sec, err := goplus.GetTokenSecurity(chainID, token.Address)
		if err == nil {
			token.DeployerAddr = sec.CreatorAddress
			token.HolderCount = sec.HolderCount
			token.IsHoneypot = sec.IsHoneypot == "1"
			token.IsMintable = sec.IsMintable == "1"

			// Instant disqualify: honeypot or mintable
			if token.IsHoneypot {
				token.QuickVerdict = "REJECT — honeypot"
				continue
			}
			if token.IsMintable {
				token.QuickVerdict = "REJECT — mintable supply"
				continue
			}
			if sec.CanTakeBackOwnership == "1" {
				token.QuickVerdict = "REJECT — owner can reclaim"
				continue
			}

			// Deployer check: see if creator has deployed other tokens
			// This is a heuristic — if deployer has many contract deployments,
			// they could be a serial deployer (higher risk of rug)
			if sec.CreatorAddress != "" {
				token.DeployerAddr = sec.CreatorAddress
				// We flag the deployer address so the agent can investigate further
				token.DeployerRisk = "check_history"
			}

			token.QuickVerdict = "PASS — basic safety OK"
		} else {
			token.QuickVerdict = "UNKNOWN — GoPlus unavailable"
		}

		// Get token age from DexScreener
		dexData, dexErr := dex.GetTokenPairs(token.Address)
		if dexErr == nil && len(dexData.Pairs) > 0 {
			var earliestMs int64
			for _, p := range dexData.Pairs {
				if p.PairCreatedAt > 0 && (earliestMs == 0 || p.PairCreatedAt < earliestMs) {
					earliestMs = p.PairCreatedAt
				}
				// Also grab volume if we don't have it
				if token.Volume24h == 0 {
					token.Volume24h = p.Volume.H24
				}
				if token.Liquidity == 0 {
					token.Liquidity = p.Liquidity.Usd
				}
			}
			if earliestMs > 0 {
				ctx := gates.ClassifyAge(earliestMs)
				token.TokenAge = string(ctx.Age)
				token.AgeHours = ctx.AgeHours
			}
		}

		enriched = append(enriched, *token)
		if len(enriched) >= limit {
			break
		}

		// Rate limit: buffer between GoPlus calls
		time.Sleep(500 * time.Millisecond)
	}

	result.Tokens = enriched
	b, _ := json.MarshalIndent(result, "", "  ")
	return string(b), nil
}

func parseFloat(s string) float64 {
	var f float64
	fmt.Sscanf(s, "%f", &f)
	return f
}
