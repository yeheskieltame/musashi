package data

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const geckoTerminalBaseURL = "https://api.geckoterminal.com/api/v2"

type GeckoTerminalClient struct {
	client *ResilientClient
}

func NewGeckoTerminalClient() *GeckoTerminalClient {
	return &GeckoTerminalClient{
		client: NewResilientClient(15*time.Second, DefaultRetryConfig),
	}
}

// GeckoResponse wraps the standard JSON:API response.
type GeckoResponse struct {
	Data json.RawMessage `json:"data"`
}

type GeckoTokenAttributes struct {
	Name         string  `json:"name"`
	Symbol       string  `json:"symbol"`
	Address      string  `json:"address"`
	PriceUsd     string  `json:"price_usd"`
	Volume24h    string  `json:"volume_usd_h24"`
	MarketCapUsd string  `json:"market_cap_usd"`
	FDVUsd       string  `json:"fdv_usd"`
}

type GeckoTokenData struct {
	ID         string               `json:"id"`
	Type       string               `json:"type"`
	Attributes GeckoTokenAttributes `json:"attributes"`
}

type VolumeUSD struct {
	H24 string `json:"h24"`
}

type GeckoPoolAttributes struct {
	Name               string             `json:"name"`
	Address            string             `json:"address"`
	BaseTokenPrice     string             `json:"base_token_price_usd"`
	QuoteTokenPrice    string             `json:"quote_token_price_usd"`
	VolumeH24          string             `json:"volume_usd_h24"`
	VolumeUSD          VolumeUSD          `json:"volume_usd"`
	ReserveUsd         string             `json:"reserve_in_usd"`
	PoolCreatedAt      string             `json:"pool_created_at"`
	PriceChangePct     PriceChangePct     `json:"price_change_percentage"`
	Transactions       GeckoTransactions  `json:"transactions"`
}

// PriceChangePct holds percentage price changes across multiple timeframes
// as returned by GeckoTerminal's pool payload.
type PriceChangePct struct {
	M5  string `json:"m5"`
	H1  string `json:"h1"`
	H6  string `json:"h6"`
	H24 string `json:"h24"`
}

// GeckoTransactions is the buy/sell breakdown from pool payload.
type GeckoTransactions struct {
	M5  GeckoTxnBucket `json:"m5"`
	H1  GeckoTxnBucket `json:"h1"`
	H6  GeckoTxnBucket `json:"h6"`
	H24 GeckoTxnBucket `json:"h24"`
}

type GeckoTxnBucket struct {
	Buys    int `json:"buys"`
	Sells   int `json:"sells"`
	Buyers  int `json:"buyers"`
	Sellers int `json:"sellers"`
}

// GetVolumeH24 returns the 24h volume from either flat or nested field.
func (a *GeckoPoolAttributes) GetVolumeH24() string {
	if a.VolumeH24 != "" {
		return a.VolumeH24
	}
	return a.VolumeUSD.H24
}

type GeckoPoolData struct {
	ID            string                  `json:"id"`
	Type          string                  `json:"type"`
	Attributes    GeckoPoolAttributes     `json:"attributes"`
	Relationships *GeckoPoolRelationships `json:"relationships,omitempty"`
}

// GeckoPoolRelationships is the JSON:API relationships block on pool payloads.
// Lets us extract the base token address without a second API call.
type GeckoPoolRelationships struct {
	BaseToken  GeckoRelRef `json:"base_token"`
	QuoteToken GeckoRelRef `json:"quote_token"`
	Network    GeckoRelRef `json:"network"`
}

type GeckoRelRef struct {
	Data struct {
		ID   string `json:"id"`
		Type string `json:"type"`
	} `json:"data"`
}

// BaseTokenAddress parses the "{network}_{address}" id format used by
// GeckoTerminal's JSON:API and returns just the address.
func (g *GeckoPoolData) BaseTokenAddress() string {
	if g.Relationships == nil {
		return ""
	}
	id := g.Relationships.BaseToken.Data.ID
	idx := strings.LastIndex(id, "_")
	if idx < 0 || idx == len(id)-1 {
		return ""
	}
	return id[idx+1:]
}

// Network returns the network slug from the relationship id (e.g. "eth").
func (g *GeckoPoolData) Network() string {
	if g.Relationships == nil {
		return ""
	}
	id := g.Relationships.BaseToken.Data.ID
	idx := strings.Index(id, "_")
	if idx < 0 {
		return ""
	}
	return id[:idx]
}

// ChainIDToNetwork maps EVM chain IDs to GeckoTerminal network slugs.
func ChainIDToNetwork(chainID int64) string {
	switch chainID {
	case 1:
		return "eth"
	case 56:
		return "bsc"
	case 137:
		return "polygon_pos"
	case 42161:
		return "arbitrum"
	case 8453:
		return "base"
	case 16661:
		return "0g"
	default:
		return "eth"
	}
}

// GetToken fetches token data.
func (c *GeckoTerminalClient) GetToken(network, address string) (*GeckoTokenData, error) {
	url := fmt.Sprintf("%s/networks/%s/tokens/%s", geckoTerminalBaseURL, network, address)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("geckoterminal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("geckoterminal error: status %d: %s", resp.StatusCode, body)
	}

	var raw struct {
		Data GeckoTokenData `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("geckoterminal decode failed: %w", err)
	}

	return &raw.Data, nil
}

// GetTokenPools fetches all pools for a token.
func (c *GeckoTerminalClient) GetTokenPools(network, address string) ([]GeckoPoolData, error) {
	url := fmt.Sprintf("%s/networks/%s/tokens/%s/pools", geckoTerminalBaseURL, network, address)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("geckoterminal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("geckoterminal error: status %d: %s", resp.StatusCode, body)
	}

	var raw struct {
		Data []GeckoPoolData `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("geckoterminal decode failed: %w", err)
	}

	return raw.Data, nil
}

// GetNewPools fetches newly created pools on a network.
func (c *GeckoTerminalClient) GetNewPools(network string) ([]GeckoPoolData, error) {
	url := fmt.Sprintf("%s/networks/%s/new_pools", geckoTerminalBaseURL, network)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("geckoterminal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("geckoterminal error: status %d: %s", resp.StatusCode, body)
	}

	var raw struct {
		Data []GeckoPoolData `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("geckoterminal decode failed: %w", err)
	}

	return raw.Data, nil
}

// GetTrendingPoolsByNetwork fetches trending pools scoped to a single
// network (chain). Use this instead of GetTrendingPools when you care about
// one chain — narrower payload and tighter relevance for hunt scoring.
func (c *GeckoTerminalClient) GetTrendingPoolsByNetwork(network string) ([]GeckoPoolData, error) {
	url := fmt.Sprintf("%s/networks/%s/trending_pools", geckoTerminalBaseURL, network)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("geckoterminal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("geckoterminal error: status %d: %s", resp.StatusCode, body)
	}

	var raw struct {
		Data []GeckoPoolData `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("geckoterminal decode failed: %w", err)
	}

	return raw.Data, nil
}

// GetTrendingPools fetches trending pools across all networks.
func (c *GeckoTerminalClient) GetTrendingPools() ([]GeckoPoolData, error) {
	url := fmt.Sprintf("%s/networks/trending_pools", geckoTerminalBaseURL)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("geckoterminal request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("geckoterminal error: status %d: %s", resp.StatusCode, body)
	}

	var raw struct {
		Data []GeckoPoolData `json:"data"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, fmt.Errorf("geckoterminal decode failed: %w", err)
	}

	return raw.Data, nil
}
