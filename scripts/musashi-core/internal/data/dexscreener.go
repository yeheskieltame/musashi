package data

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

const dexScreenerBaseURL = "https://api.dexscreener.com"

type DexScreenerClient struct {
	client *ResilientClient
}

func NewDexScreenerClient() *DexScreenerClient {
	return &DexScreenerClient{
		client: NewResilientClient(15*time.Second, DefaultRetryConfig),
	}
}

type DexPairsResponse struct {
	SchemaVersion string    `json:"schemaVersion"`
	Pairs         []DexPair `json:"pairs"`
}

type DexPair struct {
	ChainID       string `json:"chainId"`
	DexID         string `json:"dexId"`
	URL           string `json:"url"`
	PairAddress   string `json:"pairAddress"`
	PairCreatedAt int64  `json:"pairCreatedAt"`

	BaseToken  DexToken `json:"baseToken"`
	QuoteToken DexToken `json:"quoteToken"`

	PriceNative string `json:"priceNative"`
	PriceUsd    string `json:"priceUsd"`

	Txns   DexTxns   `json:"txns"`
	Volume DexVolume `json:"volume"`

	Liquidity struct {
		Usd   float64 `json:"usd"`
		Base  float64 `json:"base"`
		Quote float64 `json:"quote"`
	} `json:"liquidity"`

	FDV       float64 `json:"fdv"`
	MarketCap float64 `json:"marketCap"`

	// Info contains social/website links shown on DexScreener token page.
	// Often the only place to find Twitter/Telegram for fresh tokens.
	Info *DexPairInfo `json:"info,omitempty"`

	// Boosts reports active boost level — DexScreener's pay-to-trend feature.
	// High boosts with no organic engagement = manufactured hype trap.
	Boosts *DexBoostsField `json:"boosts,omitempty"`
}

// DexPairInfo carries socials/websites attached to a token's DexScreener listing.
type DexPairInfo struct {
	ImageURL  string         `json:"imageUrl,omitempty"`
	Websites  []DexLinkEntry `json:"websites,omitempty"`
	Socials   []DexSocial    `json:"socials,omitempty"`
}

type DexLinkEntry struct {
	Label string `json:"label,omitempty"`
	URL   string `json:"url,omitempty"`
}

type DexSocial struct {
	Type string `json:"type"` // twitter | telegram | discord | ...
	URL  string `json:"url"`
}

type DexBoostsField struct {
	Active int `json:"active"`
}

// BoostedToken is the typed shape of /token-boosts/latest/v1 entries.
type BoostedToken struct {
	URL          string         `json:"url,omitempty"`
	ChainID      string         `json:"chainId"`
	TokenAddress string         `json:"tokenAddress"`
	Amount       float64        `json:"amount"`
	TotalAmount  float64        `json:"totalAmount"`
	Icon         string         `json:"icon,omitempty"`
	Description  string         `json:"description,omitempty"`
	Links        []DexLinkEntry `json:"links,omitempty"`
}

type DexToken struct {
	Address string `json:"address"`
	Name    string `json:"name"`
	Symbol  string `json:"symbol"`
}

type DexTxns struct {
	M5  DexTxnCount `json:"m5"`
	H1  DexTxnCount `json:"h1"`
	H6  DexTxnCount `json:"h6"`
	H24 DexTxnCount `json:"h24"`
}

type DexTxnCount struct {
	Buys  int `json:"buys"`
	Sells int `json:"sells"`
}

type DexVolume struct {
	M5  float64 `json:"m5"`
	H1  float64 `json:"h1"`
	H6  float64 `json:"h6"`
	H24 float64 `json:"h24"`
}

// GetTokenPairs fetches all pairs for a token address.
// Retries automatically on rate limits and server errors.
func (c *DexScreenerClient) GetTokenPairs(address string) (*DexPairsResponse, error) {
	reqURL := fmt.Sprintf("%s/latest/dex/tokens/%s", dexScreenerBaseURL, address)

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("dexscreener request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dexscreener error: status %d: %s", resp.StatusCode, body)
	}

	var result DexPairsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dexscreener decode failed: %w", err)
	}

	return &result, nil
}

// GetPairByAddress fetches a specific pair.
func (c *DexScreenerClient) GetPairByAddress(chainID, pairAddress string) (*DexPairsResponse, error) {
	reqURL := fmt.Sprintf("%s/latest/dex/pairs/%s/%s", dexScreenerBaseURL, chainID, pairAddress)

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("dexscreener request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dexscreener error: status %d: %s", resp.StatusCode, body)
	}

	var result DexPairsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dexscreener decode failed: %w", err)
	}

	return &result, nil
}

// SearchTokens searches for tokens by query.
func (c *DexScreenerClient) SearchTokens(query string) (*DexPairsResponse, error) {
	reqURL := fmt.Sprintf("%s/latest/dex/search?q=%s", dexScreenerBaseURL, url.QueryEscape(query))

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("dexscreener request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dexscreener error: status %d: %s", resp.StatusCode, body)
	}

	var result DexPairsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dexscreener decode failed: %w", err)
	}

	return &result, nil
}

// GetBoostedTokens fetches currently boosted/trending tokens (typed).
func (c *DexScreenerClient) GetBoostedTokens() ([]BoostedToken, error) {
	reqURL := fmt.Sprintf("%s/token-boosts/latest/v1", dexScreenerBaseURL)

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("dexscreener request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dexscreener error: status %d: %s", resp.StatusCode, body)
	}

	var result []BoostedToken
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dexscreener decode failed: %w", err)
	}

	return result, nil
}

// GetTopBoostedTokens fetches tokens sorted by total boost amount.
// Useful for narrative landscape — what is being aggressively promoted.
func (c *DexScreenerClient) GetTopBoostedTokens() ([]BoostedToken, error) {
	reqURL := fmt.Sprintf("%s/token-boosts/top/v1", dexScreenerBaseURL)

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("dexscreener request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dexscreener error: status %d: %s", resp.StatusCode, body)
	}

	var result []BoostedToken
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dexscreener decode failed: %w", err)
	}

	return result, nil
}

// TokenProfile is the typed shape of /token-profiles/latest/v1.
type TokenProfile struct {
	URL          string         `json:"url,omitempty"`
	ChainID      string         `json:"chainId"`
	TokenAddress string         `json:"tokenAddress"`
	Icon         string         `json:"icon,omitempty"`
	Header       string         `json:"header,omitempty"`
	Description  string         `json:"description,omitempty"`
	Links        []DexLinkEntry `json:"links,omitempty"`
}

// GetTokenProfiles fetches the most recently updated token profiles across chains.
// Profiles include socials/links — useful for narrative discovery.
func (c *DexScreenerClient) GetTokenProfiles() ([]TokenProfile, error) {
	reqURL := fmt.Sprintf("%s/token-profiles/latest/v1", dexScreenerBaseURL)

	resp, err := c.client.Get(reqURL)
	if err != nil {
		return nil, fmt.Errorf("dexscreener request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("dexscreener error: status %d: %s", resp.StatusCode, body)
	}

	var result []TokenProfile
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("dexscreener decode failed: %w", err)
	}

	return result, nil
}
