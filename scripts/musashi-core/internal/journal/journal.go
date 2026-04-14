// Package journal implements MUSASHI's learning layer: a local JSONL index
// mapping tokens to past pipeline runs (gates + specialists + debate + judge),
// backed by 0G Storage for durable content storage.
//
// Philosophy: ConvictionLog stays strike-only (clean reputation). Journal
// captures ALL outcomes (PASS, FAIL, WARN, STRIKE_WATCH, NEED_MORE_DATA) so
// the agent can:
//   1. Cache hit on re-analysis (don't waste tokens re-running debate)
//   2. Learn from FAIL/trap patterns across past tokens
//   3. Cross-reference similar signatures against past outcomes
//
// Index lives at $MUSASHI_JOURNAL_PATH or ~/.musashi/journal.jsonl (append-only).
// Full payload lives on 0G Storage under a merkle root referenced from each line.
package journal

import (
	"bufio"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/storage"
)

// Entry is one row in the local JSONL index. Full payload (gates, specialist
// reports, debate transcript, judge reasoning) lives on 0G Storage at StorageRoot.
type Entry struct {
	Token        string    `json:"token"`
	ChainID      int64     `json:"chain_id"`
	AgentID      uint64    `json:"agent_id"`
	Kind         string    `json:"kind"`                    // PASS | STRIKE_WATCH | FAIL | WARN | NEED_MORE_DATA
	Convergence  uint8     `json:"convergence,omitempty"`   // 0-4
	TokenAge     string    `json:"token_age,omitempty"`     // fresh | early | established
	Pattern      string    `json:"pattern,omitempty"`       // hunter or trap pattern name
	FailedAt     int       `json:"failed_at,omitempty"`     // gate number of first failure (0 = none)
	Reason       string    `json:"reason,omitempty"`        // one-line judge/gate reason
	StorageRoot  string    `json:"storage_root,omitempty"`  // 0G Storage merkle root of full payload
	Timestamp    time.Time `json:"timestamp"`
	Stored       bool      `json:"stored"`                  // true if full payload uploaded to 0G Storage
}

// Payload is the full journal document stored on 0G Storage.
// Backward-compatible superset of musashi-strike-evidence/v1.
type Payload struct {
	Kind          string          `json:"kind"` // "musashi-pipeline-journal/v1"
	Token         string          `json:"token"`
	ChainID       int64           `json:"chain_id"`
	AgentID       uint64          `json:"agent_id"`
	Convergence   uint8           `json:"convergence,omitempty"`
	TokenAge      string          `json:"token_age,omitempty"`
	Pattern       string          `json:"pattern,omitempty"`
	Gates         json.RawMessage `json:"gates,omitempty"`         // PipelineResult from gate runner
	Specialists   json.RawMessage `json:"specialists,omitempty"`   // 4 specialist verdict summaries
	PatternReport json.RawMessage `json:"pattern_report,omitempty"`
	Debate        json.RawMessage `json:"debate,omitempty"`        // bull/bear summary
	Judge         json.RawMessage `json:"judge,omitempty"`         // verdict + reasoning
	Outcome       struct {
		Status   string `json:"status"`              // PASS | STRIKE_WATCH | FAIL | WARN | NEED_MORE_DATA
		Reason   string `json:"reason"`
		FailedAt int    `json:"failed_at,omitempty"`
	} `json:"outcome"`
	PublishedAt time.Time `json:"published_at"`
}

var writeMu sync.Mutex

// Path resolves the journal index path. Override with MUSASHI_JOURNAL_PATH env var.
func Path() (string, error) {
	if p := strings.TrimSpace(os.Getenv("MUSASHI_JOURNAL_PATH")); p != "" {
		return p, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("resolve home dir: %w", err)
	}
	return filepath.Join(home, ".musashi", "journal.jsonl"), nil
}

// ensureDir creates the parent directory for the journal file if missing.
func ensureDir(p string) error {
	return os.MkdirAll(filepath.Dir(p), 0o755)
}

// Append writes a single Entry to the local JSONL index. Safe for concurrent
// callers within the same process.
func Append(e *Entry) error {
	writeMu.Lock()
	defer writeMu.Unlock()

	if e.Timestamp.IsZero() {
		e.Timestamp = time.Now().UTC()
	}
	e.Token = strings.ToLower(e.Token)

	p, err := Path()
	if err != nil {
		return err
	}
	if err := ensureDir(p); err != nil {
		return fmt.Errorf("ensure journal dir: %w", err)
	}
	f, err := os.OpenFile(p, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return fmt.Errorf("open journal: %w", err)
	}
	defer f.Close()
	b, err := json.Marshal(e)
	if err != nil {
		return fmt.Errorf("marshal entry: %w", err)
	}
	if _, err := f.Write(append(b, '\n')); err != nil {
		return fmt.Errorf("write entry: %w", err)
	}
	return nil
}

// ReadAll returns every entry in the index, newest first.
func ReadAll() ([]*Entry, error) {
	p, err := Path()
	if err != nil {
		return nil, err
	}
	f, err := os.Open(p)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("open journal: %w", err)
	}
	defer f.Close()

	var entries []*Entry
	sc := bufio.NewScanner(f)
	sc.Buffer(make([]byte, 0, 64*1024), 1024*1024)
	for sc.Scan() {
		line := strings.TrimSpace(sc.Text())
		if line == "" {
			continue
		}
		var e Entry
		if err := json.Unmarshal([]byte(line), &e); err != nil {
			// Skip malformed lines rather than fail the whole query.
			continue
		}
		entries = append(entries, &e)
	}
	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("scan journal: %w", err)
	}
	// Reverse so newest is first.
	for i, j := 0, len(entries)-1; i < j; i, j = i+1, j-1 {
		entries[i], entries[j] = entries[j], entries[i]
	}
	return entries, nil
}

// Filter narrows journal entries by optional token, chain, agent, kind, and
// max age. Pass zero values to skip a filter.
type Filter struct {
	Token   string
	ChainID int64
	AgentID uint64
	Kind    string // exact match; empty = any
	MaxAge  time.Duration
	Limit   int
}

// Query returns entries matching the filter, newest first.
func Query(f Filter) ([]*Entry, error) {
	all, err := ReadAll()
	if err != nil {
		return nil, err
	}
	token := strings.ToLower(strings.TrimSpace(f.Token))
	cutoff := time.Time{}
	if f.MaxAge > 0 {
		cutoff = time.Now().UTC().Add(-f.MaxAge)
	}
	var out []*Entry
	for _, e := range all {
		if token != "" && strings.ToLower(e.Token) != token {
			continue
		}
		if f.ChainID != 0 && e.ChainID != f.ChainID {
			continue
		}
		if f.AgentID != 0 && e.AgentID != f.AgentID {
			continue
		}
		if f.Kind != "" && !strings.EqualFold(e.Kind, f.Kind) {
			continue
		}
		if !cutoff.IsZero() && e.Timestamp.Before(cutoff) {
			continue
		}
		out = append(out, e)
		if f.Limit > 0 && len(out) >= f.Limit {
			break
		}
	}
	return out, nil
}

// DefaultMaxAge returns the age-aware freshness window for a cache check.
// Fresh tokens change fast; established tokens can reuse cached analysis longer.
func DefaultMaxAge(tokenAge string) time.Duration {
	switch strings.ToLower(tokenAge) {
	case "fresh":
		return 2 * time.Hour
	case "early":
		return 6 * time.Hour
	case "established":
		return 24 * time.Hour
	default:
		return 6 * time.Hour
	}
}

// Check returns the most recent entry for a token that is still fresh per
// the age-aware window, or nil if there is no usable cache hit.
func Check(token string, chainID int64, agentID uint64, tokenAge string) (*Entry, error) {
	entries, err := Query(Filter{
		Token:   token,
		ChainID: chainID,
		AgentID: agentID,
		MaxAge:  DefaultMaxAge(tokenAge),
		Limit:   1,
	})
	if err != nil {
		return nil, err
	}
	if len(entries) == 0 {
		return nil, nil
	}
	return entries[0], nil
}

// WriteAndStore uploads the full payload to 0G Storage (best effort) and
// appends a corresponding Entry to the local index. If the 0G upload fails,
// the entry is still appended with Stored=false — the local index is always
// the source of truth, 0G Storage is the durable replica.
func WriteAndStore(p *Payload) (*Entry, error) {
	if p.Kind == "" {
		p.Kind = "musashi-pipeline-journal/v1"
	}
	if p.PublishedAt.IsZero() {
		p.PublishedAt = time.Now().UTC()
	}

	entry := &Entry{
		Token:       strings.ToLower(p.Token),
		ChainID:     p.ChainID,
		AgentID:     p.AgentID,
		Kind:        p.Outcome.Status,
		Convergence: p.Convergence,
		TokenAge:    p.TokenAge,
		Pattern:     p.Pattern,
		FailedAt:    p.Outcome.FailedAt,
		Reason:      p.Outcome.Reason,
		Timestamp:   p.PublishedAt,
	}

	// Best-effort 0G Storage upload. Failure is non-fatal — we still index locally.
	if os.Getenv("OG_CHAIN_PRIVATE_KEY") != "" {
		client := storage.NewOGStorageClient()
		if res, err := client.StoreEvidence(p); err == nil && res != nil {
			entry.StorageRoot = res.RootHash
			entry.Stored = true
		}
	}

	if err := Append(entry); err != nil {
		return entry, fmt.Errorf("append index: %w", err)
	}
	return entry, nil
}

// Fetch downloads a full journal payload from 0G Storage by merkle root.
func Fetch(storageRoot, outputPath string) error {
	client := storage.NewOGStorageClient()
	return client.DownloadFile(storageRoot, outputPath)
}
