package data

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// RedditClient fetches social signals from Reddit's public JSON API.
// No authentication required. Rate limit ~10 req/min without auth.
type RedditClient struct {
	client *ResilientClient
}

func NewRedditClient() *RedditClient {
	return &RedditClient{
		client: NewResilientClient(30*time.Second, RetryConfig{
			MaxRetries:     2,
			InitialBackoff: 2 * time.Second,
			MaxBackoff:     5 * time.Second,
		}),
	}
}

// RedditPost represents a single Reddit submission.
type RedditPost struct {
	Title        string  `json:"title"`
	Selftext     string  `json:"selftext"`
	Subreddit    string  `json:"subreddit"`
	Author       string  `json:"author"`
	Score        int     `json:"score"`
	NumComments  int     `json:"num_comments"`
	UpvoteRatio  float64 `json:"upvote_ratio"`
	CreatedUTC   float64 `json:"created_utc"`
	URL          string  `json:"url"`
	Permalink    string  `json:"permalink"`
	Distinguished string `json:"distinguished"`
}

type redditListing struct {
	Data struct {
		Children []struct {
			Data RedditPost `json:"data"`
		} `json:"children"`
	} `json:"data"`
}

// SearchPosts searches Reddit for posts matching a query.
// Searches across all subreddits sorted by relevance.
func (c *RedditClient) SearchPosts(query string, limit int) ([]RedditPost, error) {
	if limit <= 0 || limit > 50 {
		limit = 25
	}

	u := fmt.Sprintf(
		"https://www.reddit.com/search.json?q=%s&sort=relevance&t=month&limit=%d",
		url.QueryEscape(query), limit,
	)

	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return nil, fmt.Errorf("reddit request build failed: %w", err)
	}
	// Reddit blocks default Go user-agent
	req.Header.Set("User-Agent", "musashi-core/1.0 (token-analysis)")

	resp, err := c.client.Do(req, u, map[string]string{
		"User-Agent": "musashi-core/1.0 (token-analysis)",
	})
	if err != nil {
		return nil, fmt.Errorf("reddit request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("reddit error: status %d: %s", resp.StatusCode, body)
	}

	var listing redditListing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("reddit decode failed: %w", err)
	}

	posts := make([]RedditPost, 0, len(listing.Data.Children))
	for _, child := range listing.Data.Children {
		posts = append(posts, child.Data)
	}
	return posts, nil
}

// SearchCryptoSubreddits searches r/cryptocurrency for token mentions.
func (c *RedditClient) SearchCryptoSubreddits(query string, limit int) ([]RedditPost, error) {
	if limit <= 0 || limit > 50 {
		limit = 25
	}

	// Search in r/cryptocurrency specifically (simpler query, less likely to timeout)
	u := fmt.Sprintf(
		"https://www.reddit.com/r/cryptocurrency/search.json?q=%s&restrict_sr=on&sort=new&t=month&limit=%d",
		url.QueryEscape(query), limit,
	)

	resp, err := c.client.Do(nil, u, map[string]string{
		"User-Agent": "musashi-core/1.0 (token-analysis)",
	})
	if err != nil {
		return nil, fmt.Errorf("reddit request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("reddit error: status %d: %s", resp.StatusCode, body)
	}

	var listing redditListing
	if err := json.NewDecoder(resp.Body).Decode(&listing); err != nil {
		return nil, fmt.Errorf("reddit decode failed: %w", err)
	}

	posts := make([]RedditPost, 0, len(listing.Data.Children))
	for _, child := range listing.Data.Children {
		posts = append(posts, child.Data)
	}
	return posts, nil
}
