package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/cobra"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/chain"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/data"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/pipeline"
	"github.com/yeheskieltame/musashi/scripts/musashi-core/internal/storage"
)

var rootCmd = &cobra.Command{
	Use:   "musashi-core",
	Short: "MUSASHI 武蔵 — Conviction-weighted token intelligence engine",
}

var gatesCmd = &cobra.Command{
	Use:   "gates [token_address]",
	Short: "Run elimination gates on a token",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		chainID, _ := cmd.Flags().GetInt64("chain")
		output, _ := cmd.Flags().GetString("output")

		result, err := pipeline.RunGates(args[0], chainID)
		if err != nil {
			return fmt.Errorf("gate pipeline failed: %w", err)
		}

		if output == "json" {
			fmt.Println(result.JSON())
		} else {
			fmt.Println(result.Pretty())
		}
		return nil
	},
}

var strikeCmd = &cobra.Command{
	Use:   "strike [token_address]",
	Short: "Publish a STRIKE conviction to 0G Chain (only for high-conviction PASS results)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		convergence, _ := cmd.Flags().GetUint8("convergence")
		evidence, _ := cmd.Flags().GetString("evidence")
		tokenChain, _ := cmd.Flags().GetInt64("token-chain")
		agentID, _ := cmd.Flags().GetUint64("agent-id")

		if convergence < 3 || convergence > 4 {
			return fmt.Errorf("convergence must be 3 or 4 (got %d). Only high-conviction results should be published as STRIKEs", convergence)
		}

		if evidence == "" {
			return fmt.Errorf("evidence hash required. Store evidence first with 'musashi store', then pass the hash here")
		}

		result, err := chain.PublishStrike(agentID, args[0], tokenChain, convergence, evidence)
		if err != nil {
			return fmt.Errorf("strike publish failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

var storeCmd = &cobra.Command{
	Use:   "store [evidence_json]",
	Short: "Store evidence to 0G Storage (only for PASS/STRIKE results)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		forceUpload, _ := cmd.Flags().GetBool("force")

		var evidence map[string]interface{}
		if err := json.Unmarshal([]byte(args[0]), &evidence); err != nil {
			return fmt.Errorf("invalid JSON evidence: %w", err)
		}

		// Guard: only upload evidence for high-conviction results
		if !forceUpload {
			status, _ := evidence["status"].(string)
			verdict, _ := evidence["verdict"].(string)
			pass, hasBool := evidence["pass"].(bool)

			isPass := strings.EqualFold(status, "PASS") ||
				strings.EqualFold(verdict, "PASS") ||
				(hasBool && pass)

			if !isPass && status != "" {
				return fmt.Errorf("refusing to upload: evidence status is %q (not PASS). Only high-conviction STRIKE evidence should be stored on 0G Storage. Use --force to override", status)
			}
		}

		client := storage.NewOGStorageClient()

		result, err := client.StoreEvidence(evidence)
		if err != nil {
			return fmt.Errorf("evidence store failed: %w", err)
		}

		b, _ := json.MarshalIndent(result, "", "  ")
		fmt.Println(string(b))
		return nil
	},
}

var searchCmd = &cobra.Command{
	Use:   "search [query]",
	Short: "Search token by name or ticker, returns address + chain",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		limit, _ := cmd.Flags().GetInt("limit")
		dex := data.NewDexScreenerClient()

		result, err := dex.SearchTokens(args[0])
		if err != nil {
			return fmt.Errorf("search failed: %w", err)
		}

		if len(result.Pairs) == 0 {
			fmt.Println(`{"results": [], "message": "no tokens found"}`)
			return nil
		}

		type searchResult struct {
			Address   string  `json:"address"`
			Name      string  `json:"name"`
			Symbol    string  `json:"symbol"`
			Chain     string  `json:"chain"`
			PriceUsd  string  `json:"price_usd"`
			Liquidity float64 `json:"liquidity_usd"`
			Volume24h float64 `json:"volume_24h"`
			FDV       float64 `json:"fdv"`
			PairURL   string  `json:"pair_url"`
		}

		seen := make(map[string]bool)
		var results []searchResult
		for _, p := range result.Pairs {
			key := p.BaseToken.Address + p.ChainID
			if seen[key] {
				continue
			}
			seen[key] = true
			results = append(results, searchResult{
				Address:   p.BaseToken.Address,
				Name:      p.BaseToken.Name,
				Symbol:    p.BaseToken.Symbol,
				Chain:     p.ChainID,
				PriceUsd:  p.PriceUsd,
				Liquidity: p.Liquidity.Usd,
				Volume24h: p.Volume.H24,
				FDV:       p.FDV,
				PairURL:   p.URL,
			})
			if len(results) >= limit {
				break
			}
		}

		b, _ := json.MarshalIndent(results, "", "  ")
		fmt.Println(string(b))
		return nil
	},
}

var discoveryCmd = &cobra.Command{
	Use:   "discover",
	Short: "Scan for new tokens with potential",
	RunE: func(cmd *cobra.Command, args []string) error {
		chainID, _ := cmd.Flags().GetInt64("chain")
		limit, _ := cmd.Flags().GetInt("limit")

		result, err := pipeline.DiscoverTokens(chainID, limit)
		if err != nil {
			return fmt.Errorf("discovery failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

var mintAgentCmd = &cobra.Command{
	Use:   "mint-agent",
	Short: "Mint MUSASHI agent as INFT on 0G Chain",
	RunE: func(cmd *cobra.Command, args []string) error {
		name, _ := cmd.Flags().GetString("name")
		configHash, _ := cmd.Flags().GetString("config-hash")
		intelligenceHash, _ := cmd.Flags().GetString("intelligence-hash")

		result, err := chain.MintAgent(name, configHash, intelligenceHash)
		if err != nil {
			return fmt.Errorf("mint agent failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

var statusCmd = &cobra.Command{
	Use:   "status",
	Short: "Query ConvictionLog on-chain state (strike count + reputation)",
	RunE: func(cmd *cobra.Command, args []string) error {
		agentID, _ := cmd.Flags().GetUint64("agent-id")
		useAgent, _ := cmd.Flags().GetBool("per-agent")

		if useAgent {
			result, err := chain.QueryAgentReputation(agentID)
			if err != nil {
				return fmt.Errorf("agent reputation query failed: %w", err)
			}
			fmt.Println(result)
			return nil
		}

		result, err := chain.QueryReputation()
		if err != nil {
			return fmt.Errorf("status query failed: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

var agentInfoCmd = &cobra.Command{
	Use:   "agent-info",
	Short: "Query MusashiINFT on-chain agent state",
	RunE: func(cmd *cobra.Command, args []string) error {
		tokenID, _ := cmd.Flags().GetUint64("token-id")
		result, err := chain.QueryAgent(tokenID)
		if err != nil {
			return fmt.Errorf("agent info query failed: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

var recordOutcomeCmd = &cobra.Command{
	Use:   "record-outcome",
	Short: "Record outcome for a STRIKE on ConvictionLog",
	RunE: func(cmd *cobra.Command, args []string) error {
		strikeID, _ := cmd.Flags().GetUint64("strike-id")
		returnBps, _ := cmd.Flags().GetInt64("return-bps")

		result, err := chain.RecordOutcome(strikeID, returnBps)
		if err != nil {
			return fmt.Errorf("record outcome failed: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

var scanCmd = &cobra.Command{
	Use:   "scan",
	Short: "Scan, score, and rank tokens — find the best opportunities automatically",
	Long: `Fetches tokens from multiple sources (trending, new pools, boosted),
scores them based on liquidity, volume, market cap, age, and safety,
then returns a ranked list. Use --gates to auto-run the gate pipeline
on the top candidates.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		chainID, _ := cmd.Flags().GetInt64("chain")
		limit, _ := cmd.Flags().GetInt("limit")
		runGates, _ := cmd.Flags().GetBool("gates")

		result, err := pipeline.ScanTokens(chainID, limit, runGates)
		if err != nil {
			return fmt.Errorf("scan failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

var setINFTCmd = &cobra.Command{
	Use:   "set-inft [inft_address]",
	Short: "Link MusashiINFT contract to ConvictionLog (one-time setup)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		result, err := chain.SetINFT(args[0])
		if err != nil {
			return fmt.Errorf("set-inft failed: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

var updateAgentCmd = &cobra.Command{
	Use:   "update-agent",
	Short: "Update MUSASHI agent intelligence on 0G Chain",
	RunE: func(cmd *cobra.Command, args []string) error {
		tokenID, _ := cmd.Flags().GetUint64("token-id")
		intelligenceHash, _ := cmd.Flags().GetString("intelligence-hash")

		result, err := chain.UpdateAgentIntelligence(tokenID, intelligenceHash)
		if err != nil {
			return fmt.Errorf("update agent failed: %w", err)
		}

		fmt.Println(result)
		return nil
	},
}

func init() {
	gatesCmd.Flags().Int64("chain", 1, "Chain ID (1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G)")
	gatesCmd.Flags().String("output", "json", "Output format: json or pretty")

	strikeCmd.Flags().Uint8("convergence", 3, "Convergence score (3 or 4)")
	strikeCmd.Flags().String("evidence", "", "Evidence hash from 0G Storage")
	strikeCmd.Flags().Int64("token-chain", 1, "Chain ID where the token lives (1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G)")
	strikeCmd.Flags().Uint64("agent-id", 0, "INFT agent token ID")

	mintAgentCmd.Flags().String("name", "MUSASHI", "Agent name")
	mintAgentCmd.Flags().String("config-hash", "", "Config hash (from 0G Storage)")
	mintAgentCmd.Flags().String("intelligence-hash", "", "Intelligence/prompts hash (from 0G Storage)")

	updateAgentCmd.Flags().Uint64("token-id", 0, "INFT token ID")
	updateAgentCmd.Flags().String("intelligence-hash", "", "New intelligence hash")

	discoveryCmd.Flags().Int64("chain", 1, "Chain ID")
	discoveryCmd.Flags().Int("limit", 20, "Max tokens to return")

	agentInfoCmd.Flags().Uint64("token-id", 0, "INFT token ID to query")

	recordOutcomeCmd.Flags().Uint64("strike-id", 0, "Strike ID to record outcome for")
	recordOutcomeCmd.Flags().Int64("return-bps", 0, "Return in basis points (positive=win, negative=loss)")

	statusCmd.Flags().Uint64("agent-id", 0, "INFT agent token ID for per-agent reputation")
	statusCmd.Flags().Bool("per-agent", false, "Query per-agent reputation instead of global")

	storeCmd.Flags().Bool("force", false, "Force upload even if evidence status is not PASS")

	searchCmd.Flags().Int("limit", 5, "Max results to return")

	scanCmd.Flags().Int64("chain", 0, "Filter by chain ID (0=all, 1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G)")
	scanCmd.Flags().Int("limit", 10, "Max tokens to return")
	scanCmd.Flags().Bool("gates", false, "Auto-run gate pipeline on top 5 candidates")

	rootCmd.AddCommand(gatesCmd, strikeCmd, storeCmd, discoveryCmd, mintAgentCmd, updateAgentCmd, statusCmd, agentInfoCmd, recordOutcomeCmd, searchCmd, setINFTCmd, scanCmd)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
