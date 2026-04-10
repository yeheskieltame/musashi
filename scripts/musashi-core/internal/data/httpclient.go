package data

import (
	"fmt"
	"io"
	"math"
	"net/http"
	"time"
)

// RetryConfig controls retry behavior for HTTP requests.
type RetryConfig struct {
	MaxRetries     int
	InitialBackoff time.Duration
	MaxBackoff     time.Duration
}

// DefaultRetryConfig is suitable for public rate-limited APIs.
var DefaultRetryConfig = RetryConfig{
	MaxRetries:     3,
	InitialBackoff: 1 * time.Second,
	MaxBackoff:     8 * time.Second,
}

// ResilientClient wraps http.Client with retry and backoff logic.
type ResilientClient struct {
	client *http.Client
	retry  RetryConfig
}

// NewResilientClient creates an HTTP client with retry/backoff support.
func NewResilientClient(timeout time.Duration, retry RetryConfig) *ResilientClient {
	return &ResilientClient{
		client: &http.Client{Timeout: timeout},
		retry:  retry,
	}
}

// Get performs an HTTP GET with automatic retry on transient failures and rate limits.
// Returns the response only on success (2xx). Caller must close resp.Body.
func (c *ResilientClient) Get(url string) (*http.Response, error) {
	return c.Do(&http.Request{Method: "GET"}, url, nil)
}

// Do performs an HTTP request with retry logic. If reqTemplate is provided,
// its headers are copied to each attempt. For GET requests, body can be nil.
func (c *ResilientClient) Do(reqTemplate *http.Request, url string, headers map[string]string) (*http.Response, error) {
	var lastErr error

	for attempt := 0; attempt <= c.retry.MaxRetries; attempt++ {
		if attempt > 0 {
			backoff := time.Duration(float64(c.retry.InitialBackoff) * math.Pow(2, float64(attempt-1)))
			if backoff > c.retry.MaxBackoff {
				backoff = c.retry.MaxBackoff
			}
			time.Sleep(backoff)
		}

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return nil, fmt.Errorf("failed to build request: %w", err)
		}

		// Copy headers from template
		if reqTemplate != nil {
			for k, vals := range reqTemplate.Header {
				for _, v := range vals {
					req.Header.Set(k, v)
				}
			}
		}
		for k, v := range headers {
			req.Header.Set(k, v)
		}

		resp, err := c.client.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("request failed (attempt %d/%d): %w", attempt+1, c.retry.MaxRetries+1, err)
			continue
		}

		// Retry on rate limit (429) and server errors (500, 502, 503, 504)
		if resp.StatusCode == http.StatusTooManyRequests ||
			resp.StatusCode >= 500 {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			lastErr = fmt.Errorf("status %d (attempt %d/%d): %s", resp.StatusCode, attempt+1, c.retry.MaxRetries+1, body)
			continue
		}

		return resp, nil
	}

	return nil, fmt.Errorf("all %d attempts failed: %w", c.retry.MaxRetries+1, lastErr)
}
