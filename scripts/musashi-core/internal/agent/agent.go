package agent

import (
	"bytes"
	"encoding/json"
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// RunSonnet spawns a Claude CLI process (Sonnet model) with the given prompt
// and returns the text response. The agent can use WebSearch and WebFetch tools
// to gather real-time data from the internet.
//
// This is used by Gate 4 (Social) and Gate 5 (Narrative) to perform AI-powered
// analysis that requires web browsing capabilities.
func RunSonnet(prompt string, timeout time.Duration) (string, error) {
	args := []string{
		"-p",
		"--verbose",
		"--model", "sonnet",
		"--output-format", "json",
		"--allowedTools", "WebSearch,WebFetch",
		"--no-session-persistence",
		prompt,
	}

	cmd := exec.Command("claude", args...)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Start with timeout
	if err := cmd.Start(); err != nil {
		return "", fmt.Errorf("failed to start claude: %w", err)
	}

	done := make(chan error, 1)
	go func() { done <- cmd.Wait() }()

	select {
	case err := <-done:
		if err != nil {
			return "", fmt.Errorf("claude error: %w (stderr: %s)", err, stderr.String())
		}
	case <-time.After(timeout):
		cmd.Process.Kill()
		return "", fmt.Errorf("claude timed out after %v", timeout)
	}

	// Parse JSON output to extract result text
	output := stdout.String()

	// Try to parse as JSON (--output-format json returns {"type":"result","result":"..."})
	var result struct {
		Type   string `json:"type"`
		Result string `json:"result"`
	}
	if err := json.Unmarshal([]byte(output), &result); err == nil && result.Result != "" {
		return result.Result, nil
	}

	// Fallback: return raw output trimmed
	return strings.TrimSpace(output), nil
}

// ParseGateVerdict extracts a structured verdict from agent response text.
// Looks for STATUS: PASS/FAIL/WARN and SCORE: N patterns.
type GateVerdict struct {
	Status string // PASS, FAIL, WARN
	Score  int    // 1-10
	Report string // Full agent report
}

func ParseGateVerdict(response string) GateVerdict {
	v := GateVerdict{
		Status: "WARN", // default
		Score:  5,
		Report: response,
	}

	upper := strings.ToUpper(response)

	// Extract status
	for _, keyword := range []string{"STATUS: PASS", "VERDICT: PASS", "MOMENTUM: RISING", "STAGE: FORMING", "STAGE: GROWING"} {
		if strings.Contains(upper, keyword) {
			v.Status = "PASS"
			break
		}
	}
	for _, keyword := range []string{"STATUS: FAIL", "VERDICT: FAIL", "MOMENTUM: DECLINING", "STAGE: DECLINING"} {
		if strings.Contains(upper, keyword) {
			v.Status = "FAIL"
			break
		}
	}

	// Extract score
	for _, prefix := range []string{"SCORE: ", "SCORE: "} {
		if idx := strings.Index(upper, prefix); idx != -1 {
			scoreStr := strings.TrimSpace(response[idx+len(prefix):])
			if len(scoreStr) > 0 {
				score := 0
				fmt.Sscanf(scoreStr, "%d", &score)
				if score >= 1 && score <= 10 {
					v.Score = score
				}
			}
			break
		}
	}

	// Score-based status override
	if v.Score >= 7 && v.Status == "WARN" {
		v.Status = "PASS"
	}
	if v.Score <= 3 {
		v.Status = "FAIL"
	}

	return v
}
