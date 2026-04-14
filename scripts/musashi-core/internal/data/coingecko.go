package data

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const coinGeckoBaseURL = "https://api.coingecko.com/api/v3"

type CoinGeckoClient struct {
	client *ResilientClient
}

func NewCoinGeckoClient() *CoinGeckoClient {
	return &CoinGeckoClient{
		client: NewResilientClient(15*time.Second, DefaultRetryConfig),
	}
}

type GlobalData struct {
	Data struct {
		TotalMarketCap          map[string]float64 `json:"total_market_cap"`
		TotalVolume             map[string]float64 `json:"total_volume"`
		MarketCapPercentage     map[string]float64 `json:"market_cap_percentage"`
		MarketCapChangePerc24h  float64            `json:"market_cap_change_percentage_24h_usd"`
	} `json:"data"`
}

type TrendingResponse struct {
	Coins []struct {
		Item struct {
			ID            string  `json:"id"`
			CoinID        int     `json:"coin_id"`
			Name          string  `json:"name"`
			Symbol        string  `json:"symbol"`
			MarketCapRank int     `json:"market_cap_rank"`
			Score         int     `json:"score"`
			PriceBTC      float64 `json:"price_btc"`
		} `json:"item"`
	} `json:"coins"`
}

type CoinCategory struct {
	ID                string  `json:"id"`
	Name              string  `json:"name"`
	MarketCap         float64 `json:"market_cap"`
	MarketCapChange24h float64 `json:"market_cap_change_24h"`
	Volume24h         float64 `json:"volume_24h"`
	Top3Coins         []string `json:"top_3_coins"`
}

// GetGlobal fetches global market data (total market cap, BTC dominance).
func (c *CoinGeckoClient) GetGlobal() (*GlobalData, error) {
	url := fmt.Sprintf("%s/global", coinGeckoBaseURL)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("coingecko request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("coingecko error: status %d: %s", resp.StatusCode, body)
	}

	var result GlobalData
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("coingecko decode failed: %w", err)
	}

	return &result, nil
}

// GetTrending fetches trending coins.
func (c *CoinGeckoClient) GetTrending() (*TrendingResponse, error) {
	url := fmt.Sprintf("%s/search/trending", coinGeckoBaseURL)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("coingecko request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("coingecko error: status %d: %s", resp.StatusCode, body)
	}

	var result TrendingResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("coingecko decode failed: %w", err)
	}

	return &result, nil
}

// CoinSearchResult represents a coin from the search endpoint.
type CoinSearchResult struct {
	ID            string `json:"id"`
	Name          string `json:"name"`
	Symbol        string `json:"symbol"`
	MarketCapRank int    `json:"market_cap_rank"`
	Thumb         string `json:"thumb"`
}

type CoinSearchResponse struct {
	Coins []CoinSearchResult `json:"coins"`
}

// CoinDetail contains community and market data for a specific coin.
type CoinDetail struct {
	ID     string `json:"id"`
	Symbol string `json:"symbol"`
	Name   string `json:"name"`

	Categories []string `json:"categories"`

	Links struct {
		Homepage      []string `json:"homepage"`
		Twitter       string   `json:"twitter_screen_name"`
		Telegram      string   `json:"telegram_channel_identifier"`
		Subreddit     string   `json:"subreddit_url"`
		ChatURL       []string `json:"chat_url"`
		OfficialForum []string `json:"official_forum_url"`
	} `json:"links"`

	CommunityData struct {
		TwitterFollowers   int     `json:"twitter_followers"`
		RedditSubscribers  int     `json:"reddit_subscribers"`
		RedditActive48h    float64 `json:"reddit_accounts_active_48h"`
		RedditPostsAvg48h  float64 `json:"reddit_average_posts_48h"`
		RedditCommentAvg48h float64 `json:"reddit_average_comments_48h"`
		TelegramMembers    int     `json:"telegram_channel_user_count"`
	} `json:"community_data"`

	MarketData struct {
		MarketCapRank int `json:"market_cap_rank"`
	} `json:"market_data"`

	SentimentUpVotes   float64 `json:"sentiment_votes_up_percentage"`
	SentimentDownVotes float64 `json:"sentiment_votes_down_percentage"`
	WatchlistUsers     int     `json:"watchlist_portfolio_users"`
}

// SearchCoins searches CoinGecko for a coin by name or symbol.
func (c *CoinGeckoClient) SearchCoins(query string) (*CoinSearchResponse, error) {
	url := fmt.Sprintf("%s/search?query=%s", coinGeckoBaseURL, query)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("coingecko search failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("coingecko error: status %d: %s", resp.StatusCode, body)
	}

	var result CoinSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("coingecko decode failed: %w", err)
	}

	return &result, nil
}

// GetCoinDetail fetches detailed coin info including community data and categories.
func (c *CoinGeckoClient) GetCoinDetail(coinID string) (*CoinDetail, error) {
	url := fmt.Sprintf("%s/coins/%s?localization=false&tickers=false&market_data=true&community_data=true&developer_data=false&sparkline=false", coinGeckoBaseURL, coinID)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("coingecko coin detail failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("coingecko error: status %d: %s", resp.StatusCode, body)
	}

	var result CoinDetail
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("coingecko decode failed: %w", err)
	}

	return &result, nil
}

// ChainIDToCoinGeckoPlatform maps EVM chain IDs to CoinGecko asset platform
// slugs used by the /coins/{platform}/contract/{address} endpoint.
//
// Contract lookup is the ONLY reliable way to disambiguate tokens that share
// a symbol across chains (e.g. "0G" exists as an L1 infra token on BSC + as
// unrelated Solana memecoins). Symbol-based search is a trap — CoinGecko's
// /search endpoint ranks by market cap rank and will return the WRONG token
// when multiple tokens share a ticker.
func ChainIDToCoinGeckoPlatform(chainID int64) string {
	switch chainID {
	case 1:
		return "ethereum"
	case 56:
		return "binance-smart-chain"
	case 137:
		return "polygon-pos"
	case 42161:
		return "arbitrum-one"
	case 8453:
		return "base"
	case 10:
		return "optimistic-ethereum"
	case 43114:
		return "avalanche"
	case 250:
		return "fantom"
	case 100:
		return "xdai"
	default:
		return ""
	}
}

// GetCoinByContract looks up a coin by its contract address on a specific
// asset platform. This is the precise disambiguation path — no symbol
// guessing. Returns a full CoinDetail identical to GetCoinDetail.
//
// Use this whenever you know both the chain and the token address. Fall
// back to SearchCoins + GetCoinDetail only when contract lookup fails
// (e.g. the token isn't indexed by CoinGecko yet).
func (c *CoinGeckoClient) GetCoinByContract(platform, contractAddress string) (*CoinDetail, error) {
	if platform == "" || contractAddress == "" {
		return nil, fmt.Errorf("platform and contract address required")
	}
	url := fmt.Sprintf("%s/coins/%s/contract/%s", coinGeckoBaseURL, platform, contractAddress)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("coingecko contract lookup failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode == http.StatusNotFound {
		return nil, fmt.Errorf("coingecko: contract not indexed on %s", platform)
	}
	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("coingecko contract lookup error: status %d: %s", resp.StatusCode, body)
	}

	var result CoinDetail
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("coingecko decode failed: %w", err)
	}
	return &result, nil
}

// GetCategories fetches coin categories with market data.
func (c *CoinGeckoClient) GetCategories() ([]CoinCategory, error) {
	url := fmt.Sprintf("%s/coins/categories", coinGeckoBaseURL)

	resp, err := c.client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("coingecko request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("coingecko error: status %d: %s", resp.StatusCode, body)
	}

	var result []CoinCategory
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, fmt.Errorf("coingecko decode failed: %w", err)
	}

	return result, nil
}
