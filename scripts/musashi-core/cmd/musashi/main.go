package main

import (
	"encoding/hex"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/ethereum/go-ethereum/common"
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
		skipAI, _ := cmd.Flags().GetBool("skip-ai")

		result, err := pipeline.RunGates(args[0], chainID, skipAI)
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
	Short: "Mint MUSASHI agent as ERC-7857 INFT on 0G Chain (requires sealed intelligence)",
	Long: `Mints an INFT whose intelligence lives as an encrypted blob in 0G Storage.

You must first run 'seal-intelligence' to produce:
  - a 0G Storage merkle root (the --storage-root for mint-agent)
  - a sealed symmetric key file (the --sealed-key-file)
The metadata hash is a bytes32 commitment to a public descriptor (name, version, etc).`,
	RunE: func(cmd *cobra.Command, args []string) error {
		name, _ := cmd.Flags().GetString("name")
		storageRoot, _ := cmd.Flags().GetString("storage-root")
		metadataHash, _ := cmd.Flags().GetString("metadata-hash")
		sealedKeyFile, _ := cmd.Flags().GetString("sealed-key-file")

		if sealedKeyFile == "" {
			return fmt.Errorf("--sealed-key-file required (run 'seal-intelligence' first)")
		}
		sealedKey, err := readSealedKey(sealedKeyFile)
		if err != nil {
			return err
		}
		if metadataHash == "" {
			metadataHash = "0x" + strings.Repeat("00", 32)
		}

		result, err := chain.MintAgent(name, storageRoot, metadataHash, sealedKey)
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

var historyCmd = &cobra.Command{
	Use:   "history",
	Short: "Query strike history + reputation for an agent (memory/learning data source)",
	RunE: func(cmd *cobra.Command, args []string) error {
		agentID, _ := cmd.Flags().GetUint64("agent-id")
		limit, _ := cmd.Flags().GetInt("limit")

		result, err := chain.QueryHistory(agentID, limit)
		if err != nil {
			return fmt.Errorf("history query failed: %w", err)
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
	Short: "Rotate MUSASHI agent intelligence (new 0G Storage root + fresh sealed key)",
	RunE: func(cmd *cobra.Command, args []string) error {
		tokenID, _ := cmd.Flags().GetUint64("token-id")
		storageRoot, _ := cmd.Flags().GetString("storage-root")
		sealedKeyFile, _ := cmd.Flags().GetString("sealed-key-file")

		if sealedKeyFile == "" {
			return fmt.Errorf("--sealed-key-file required (run 'seal-intelligence' first)")
		}
		sealedKey, err := readSealedKey(sealedKeyFile)
		if err != nil {
			return err
		}

		result, err := chain.UpdateAgentIntelligence(tokenID, storageRoot, sealedKey)
		if err != nil {
			return fmt.Errorf("update agent failed: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

// readSealedKey reads a sealed key file. Accepts hex (0x-prefixed or raw) or
// a raw binary file — auto-detects by sniffing the contents.
func readSealedKey(path string) ([]byte, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("read sealed-key-file: %w", err)
	}
	trimmed := strings.TrimSpace(string(raw))
	if strings.HasPrefix(trimmed, "0x") || strings.HasPrefix(trimmed, "0X") {
		trimmed = trimmed[2:]
	}
	if b, err := hex.DecodeString(trimmed); err == nil && len(b) > 0 {
		return b, nil
	}
	// Not hex — assume raw binary
	return raw, nil
}

// sealIntelligenceCmd encrypts a file, uploads the ciphertext to 0G Storage,
// and writes a sealed-key file that wraps the AES key to the deployer pubkey.
var sealIntelligenceCmd = &cobra.Command{
	Use:   "seal-intelligence",
	Short: "Encrypt intelligence bundle + upload to 0G Storage + seal AES key to owner pubkey",
	Long: `Implements the ERC-7857 encrypted-metadata flow for MUSASHI:

  1. Read the plaintext intelligence file (e.g. a tarball of prompts/ + SKILL.md).
  2. Generate a random AES-256 key; encrypt the file with AES-256-CTR.
  3. Upload the ciphertext to 0G Storage via 0g-storage-client (get merkle root).
  4. ECIES-wrap the AES key to the owner's secp256k1 pubkey (deployer by default).
  5. Write the wrapped key to --sealed-key-out and print {storage_root, sealed_key_path}.

The wrapped key + storage root are what you pass to 'mint-agent' / 'update-agent'.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		inputPath, _ := cmd.Flags().GetString("input")
		sealedOut, _ := cmd.Flags().GetString("sealed-key-out")
		ciphertextOut, _ := cmd.Flags().GetString("ciphertext-out")

		if inputPath == "" {
			return fmt.Errorf("--input required (plaintext intelligence file)")
		}
		if sealedOut == "" {
			sealedOut = inputPath + ".sealed.hex"
		}
		if ciphertextOut == "" {
			ciphertextOut = filepath.Join(os.TempDir(), fmt.Sprintf("musashi-intel-%d.enc", time.Now().Unix()))
		}

		_, pub, _, err := chain.LoadDeployerKey()
		if err != nil {
			return fmt.Errorf("load deployer key: %w", err)
		}

		bundle, err := chain.SealBundle(inputPath, ciphertextOut, pub)
		if err != nil {
			return fmt.Errorf("seal bundle: %w", err)
		}

		client := storage.NewOGStorageClient()
		uploaded, err := client.UploadFile(bundle.CiphertextPath)
		if err != nil {
			return fmt.Errorf("upload ciphertext to 0G Storage: %w", err)
		}

		if err := os.WriteFile(sealedOut, []byte("0x"+hex.EncodeToString(bundle.SealedKey)), 0600); err != nil {
			return fmt.Errorf("write sealed-key-out: %w", err)
		}

		out := map[string]interface{}{
			"storage_root":      uploaded.RootHash,
			"tx_hash":           uploaded.TxHash,
			"explorer_url":      uploaded.ExplorerURL,
			"storage_scan":      uploaded.StorageScan,
			"ciphertext_path":   bundle.CiphertextPath,
			"sealed_key_path":   sealedOut,
			"sealed_key_length": len(bundle.SealedKey),
			"note":              "Pass storage_root + sealed_key_path to mint-agent / update-agent",
		}
		b, _ := json.MarshalIndent(out, "", "  ")
		fmt.Println(string(b))
		return nil
	},
}

// verifyCmd downloads a strike's evidence from 0G Storage with merkle proof
// verification, proving the on-chain evidenceHash actually resolves to
// retrievable and tamper-evident content.
var verifyCmd = &cobra.Command{
	Use:   "verify",
	Short: "Download + cryptographically verify evidence for a strike from 0G Storage",
	Long: `Reads the strike's evidenceHash from ConvictionLog (or accepts --root directly),
downloads the file from 0G Storage using 0g-storage-client --proof, and
prints the verified evidence. Use this in the demo to show end-to-end
0G Storage integration: on-chain pointer → off-chain encrypted/raw blob →
cryptographic integrity proof.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		strikeID, _ := cmd.Flags().GetUint64("strike-id")
		rootFlag, _ := cmd.Flags().GetString("root")
		outputPath, _ := cmd.Flags().GetString("out")
		hasStrike := cmd.Flags().Changed("strike-id")

		if !hasStrike && rootFlag == "" {
			return fmt.Errorf("either --strike-id or --root is required")
		}

		var root string
		var strike *chain.StrikeData
		if hasStrike {
			s, err := chain.QueryStrike(strikeID)
			if err != nil {
				return fmt.Errorf("query strike: %w", err)
			}
			strike = s
			root = s.EvidenceHash
		} else {
			root = rootFlag
		}

		if outputPath == "" {
			outputPath = filepath.Join(os.TempDir(), fmt.Sprintf("musashi-verify-%d.bin", time.Now().Unix()))
		}

		client := storage.NewOGStorageClient()
		if err := client.DownloadFile(root, outputPath); err != nil {
			return fmt.Errorf("0G Storage download (with --proof) failed: %w", err)
		}

		stat, _ := os.Stat(outputPath)
		var size int64
		if stat != nil {
			size = stat.Size()
		}

		out := map[string]interface{}{
			"verified":       true,
			"storage_root":   root,
			"output_path":    outputPath,
			"bytes":          size,
			"proof_verified": "merkle proof validated by 0g-storage-client --proof",
		}
		if strike != nil {
			out["strike"] = strike
		}
		b, _ := json.MarshalIndent(out, "", "  ")
		fmt.Println(string(b))
		return nil
	},
}

// orchestrateCmd chains the full pipeline: gates → (optional) store → (optional) strike.
//
// STRIKE publishing is GUARDED. Gates passing is necessary but NOT sufficient —
// gates only filter out obvious garbage. A real STRIKE requires:
//   1. Gates PASS (automated elimination — this command)
//   2. Specialist analysis + cross-domain pattern detection (agent-driven)
//   3. Adversarial debate with live evidence (agent-driven)
//   4. Binary judge verdict = PASS (agent-driven — no hesitation)
//
// The orchestrate command cannot perform steps 2–4 on its own; they require
// the LLM agent context (Claude Code / OpenClaw). So we refuse to publish
// unless the caller explicitly confirms a judge PASS via --judge-verdict PASS.
//
// Modes:
//   (default)                                 gates only, no upload, no strike
//   --store-evidence                          gates + upload to 0G Storage (no strike)
//   --judge-verdict PASS --convergence 3|4    gates + upload + STRIKE (full path)
//
// This keeps the on-chain conviction history clean: every STRIKE is a
// deliberate, high-conviction signal, never a false alarm from auto-running.
var orchestrateCmd = &cobra.Command{
	Use:   "orchestrate [token_address]",
	Short: "Gates → (optional) 0G Storage → (optional) STRIKE — strike requires explicit judge verdict",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		chainID, _ := cmd.Flags().GetInt64("chain")
		agentID, _ := cmd.Flags().GetUint64("agent-id")
		convergence, _ := cmd.Flags().GetUint8("convergence")
		skipAI, _ := cmd.Flags().GetBool("skip-ai")
		storeEvidence, _ := cmd.Flags().GetBool("store-evidence")
		judgeVerdict, _ := cmd.Flags().GetString("judge-verdict")
		judgeReason, _ := cmd.Flags().GetString("judge-reason")

		judgeVerdict = strings.ToUpper(strings.TrimSpace(judgeVerdict))
		publishStrike := judgeVerdict == "PASS"
		if publishStrike {
			// Strike path implies evidence upload and a real convergence score.
			storeEvidence = true
			if convergence < 3 || convergence > 4 {
				return fmt.Errorf("--convergence must be 3 or 4 when --judge-verdict=PASS (got %d). A real STRIKE is high-conviction only", convergence)
			}
			if !common.IsHexAddress(args[0]) {
				return fmt.Errorf("token address %q is not a valid hex address", args[0])
			}
		}

		report := map[string]interface{}{
			"token":    args[0],
			"chain_id": chainID,
			"steps":    []string{},
			"mode":     orchestrateMode(storeEvidence, publishStrike),
		}
		addStep := func(name string) {
			report["steps"] = append(report["steps"].([]string), name)
		}

		// Step 1: gates (always)
		addStep("gates")
		gateResult, err := pipeline.RunGates(args[0], chainID, skipAI)
		if err != nil {
			return fmt.Errorf("gate pipeline failed: %w", err)
		}
		report["gate_status"] = gateResult.Status
		report["gates"] = gateResult

		if gateResult.Status != "PASS" {
			report["failed_at"] = gateResult.FailedAt
			report["result"] = "STOPPED: gates did not pass. No 0G Storage upload, no STRIKE (keeps on-chain history clean)."
			b, _ := json.MarshalIndent(report, "", "  ")
			fmt.Println(string(b))
			return nil
		}

		// Gate-only mode: stop here.
		if !storeEvidence && !publishStrike {
			report["result"] = "Gates PASS. Refusing to upload or strike without explicit --store-evidence / --judge-verdict. This is intentional — gates alone are not conviction."
			b, _ := json.MarshalIndent(report, "", "  ")
			fmt.Println(string(b))
			return nil
		}

		// Step 2: store evidence on 0G Storage
		addStep("store_evidence_0g_storage")
		evidencePayload := map[string]interface{}{
			"kind":           "musashi-strike-evidence/v1",
			"token":          args[0],
			"chain_id":       chainID,
			"agent_id":       agentID,
			"convergence":    convergence,
			"gates":          gateResult,
			"judge_verdict":  judgeVerdict,
			"judge_reason":   judgeReason,
			"published_at":   time.Now().UTC().Format(time.RFC3339),
		}

		client := storage.NewOGStorageClient()
		stored, err := client.StoreEvidence(evidencePayload)
		if err != nil {
			return fmt.Errorf("0G Storage upload failed: %w", err)
		}
		report["storage_root"] = stored.RootHash
		report["storage_tx"] = stored.TxHash
		report["storage_scan"] = stored.StorageScan
		report["download_cmd"] = stored.DownloadCmd

		if !publishStrike {
			report["result"] = "Evidence stored on 0G Storage. No STRIKE published (missing --judge-verdict=PASS)."
			b, _ := json.MarshalIndent(report, "", "  ")
			fmt.Println(string(b))
			return nil
		}

		// Step 3: publish STRIKE on 0G Chain using the REAL merkle root as evidenceHash
		addStep("publish_strike_0g_chain")
		strikeResult, err := chain.PublishStrike(agentID, args[0], chainID, convergence, stored.RootHash)
		if err != nil {
			return fmt.Errorf("strike publish failed: %w", err)
		}
		var strikeJSON map[string]interface{}
		_ = json.Unmarshal([]byte(strikeResult), &strikeJSON)
		report["strike"] = strikeJSON
		report["result"] = "STRIKE published with verifiable 0G Storage evidence (judge verdict PASS)"

		b, _ := json.MarshalIndent(report, "", "  ")
		fmt.Println(string(b))
		return nil
	},
}

func orchestrateMode(storeEvidence, publishStrike bool) string {
	switch {
	case publishStrike:
		return "strike (gates + storage + chain)"
	case storeEvidence:
		return "store-evidence (gates + storage, no strike)"
	default:
		return "analyze-only (gates, no storage, no strike)"
	}
}

// transferAgentCmd performs an ERC-7857 sealed transfer. For the hackathon the
// Go binary plays both owner AND oracle roles (same OG_CHAIN_PRIVATE_KEY), so
// this command (a) derives a fresh AES key + uploads re-encrypted intelligence,
// (b) signs the transferDigest as the oracle, (c) submits the transfer tx.
var transferAgentCmd = &cobra.Command{
	Use:   "transfer-agent",
	Short: "Sealed ERC-7857 transfer (re-encrypts intelligence for the new owner)",
	RunE: func(cmd *cobra.Command, args []string) error {
		tokenID, _ := cmd.Flags().GetUint64("token-id")
		to, _ := cmd.Flags().GetString("to")
		newRoot, _ := cmd.Flags().GetString("storage-root")
		sealedKeyFile, _ := cmd.Flags().GetString("sealed-key-file")
		currentVersion, _ := cmd.Flags().GetUint("current-version")

		if to == "" || newRoot == "" || sealedKeyFile == "" {
			return fmt.Errorf("--to, --storage-root and --sealed-key-file are required")
		}
		sealedKey, err := readSealedKey(sealedKeyFile)
		if err != nil {
			return err
		}

		// Build oracle proof: fetch current on-chain root and sign the digest.
		agentJSON, err := chain.QueryAgent(tokenID)
		if err != nil {
			return fmt.Errorf("query agent: %w", err)
		}
		var agent struct {
			StorageRoot string `json:"storage_root"`
			Version     uint16 `json:"version"`
		}
		_ = json.Unmarshal([]byte(agentJSON), &agent)
		if currentVersion == 0 {
			currentVersion = uint(agent.Version)
		}

		priv, _, _, err := chain.LoadDeployerKey()
		if err != nil {
			return err
		}
		oldRoot := common.HexToHash(agent.StorageRoot)
		newRootHash := common.HexToHash(newRoot)
		toAddr := common.HexToAddress(to)
		contract := common.HexToAddress(os.Getenv("MUSASHI_INFT_ADDRESS"))

		var oldRootArr, newRootArr [32]byte
		copy(oldRootArr[:], oldRoot.Bytes())
		copy(newRootArr[:], newRootHash.Bytes())

		proof, err := chain.SignTransferDigest(priv, chain.OGMainnetChainID, contract, tokenID, uint16(currentVersion), oldRootArr, newRootArr, toAddr)
		if err != nil {
			return fmt.Errorf("sign transfer digest: %w", err)
		}

		result, err := chain.TransferAgent(tokenID, to, newRoot, sealedKey, proof)
		if err != nil {
			return fmt.Errorf("transfer: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

// setOracleCmd configures the re-encryption oracle on MusashiINFT (one-time).
var setOracleCmd = &cobra.Command{
	Use:   "set-oracle [oracle_address]",
	Short: "Set the re-encryption oracle address on MusashiINFT (one-time setup)",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		result, err := chain.SetOracleAddress(args[0])
		if err != nil {
			return fmt.Errorf("set-oracle failed: %w", err)
		}
		fmt.Println(result)
		return nil
	},
}

func init() {
	gatesCmd.Flags().Int64("chain", 1, "Chain ID (1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G)")
	gatesCmd.Flags().String("output", "json", "Output format: json or pretty")
	gatesCmd.Flags().Bool("skip-ai", false, "Skip AI-powered gates 4-5 (faster, use when debate handles social/narrative)")

	strikeCmd.Flags().Uint8("convergence", 3, "Convergence score (3 or 4)")
	strikeCmd.Flags().String("evidence", "", "Evidence hash from 0G Storage")
	strikeCmd.Flags().Int64("token-chain", 1, "Chain ID where the token lives (1=ETH, 56=BSC, 137=Polygon, 42161=Arbitrum, 8453=Base, 16661=0G)")
	strikeCmd.Flags().Uint64("agent-id", 0, "INFT agent token ID")

	mintAgentCmd.Flags().String("name", "MUSASHI", "Agent name")
	mintAgentCmd.Flags().String("storage-root", "", "0G Storage merkle root of the encrypted intelligence bundle (from seal-intelligence)")
	mintAgentCmd.Flags().String("metadata-hash", "", "bytes32 public descriptor hash (optional; defaults to zero)")
	mintAgentCmd.Flags().String("sealed-key-file", "", "path to the hex-encoded ECIES-sealed AES key (from seal-intelligence)")

	updateAgentCmd.Flags().Uint64("token-id", 0, "INFT token ID")
	updateAgentCmd.Flags().String("storage-root", "", "new 0G Storage merkle root (from seal-intelligence)")
	updateAgentCmd.Flags().String("sealed-key-file", "", "path to the freshly-rotated sealed AES key")

	sealIntelligenceCmd.Flags().String("input", "", "plaintext intelligence bundle path (required)")
	sealIntelligenceCmd.Flags().String("sealed-key-out", "", "where to write the ECIES-sealed AES key (default: <input>.sealed.hex)")
	sealIntelligenceCmd.Flags().String("ciphertext-out", "", "where to write the AES-256-CTR ciphertext before upload (default: temp file)")

	verifyCmd.Flags().Uint64("strike-id", 0, "strike ID to verify (reads evidenceHash from ConvictionLog)")
	verifyCmd.Flags().String("root", "", "0G Storage merkle root to verify directly (alternative to --strike-id)")
	verifyCmd.Flags().String("out", "", "where to write the downloaded file (default: temp file)")

	orchestrateCmd.Flags().Int64("chain", 1, "Chain ID")
	orchestrateCmd.Flags().Uint64("agent-id", 0, "INFT agent token ID")
	orchestrateCmd.Flags().Uint8("convergence", 0, "Convergence score (3 or 4) — REQUIRED only when publishing a STRIKE")
	orchestrateCmd.Flags().Bool("skip-ai", true, "Skip AI-powered gates 4-5 (faster; debate route handles them)")
	orchestrateCmd.Flags().Bool("store-evidence", false, "Upload the gate result to 0G Storage (even without publishing a strike)")
	orchestrateCmd.Flags().String("judge-verdict", "", "Judge verdict from the full agent pipeline. Set to PASS to actually publish a STRIKE. Anything else = analyze-only.")
	orchestrateCmd.Flags().String("judge-reason", "", "One-line rationale from the judge agent (stored in 0G Storage evidence)")

	transferAgentCmd.Flags().Uint64("token-id", 0, "INFT token ID to transfer")
	transferAgentCmd.Flags().String("to", "", "new owner address")
	transferAgentCmd.Flags().String("storage-root", "", "new 0G Storage root (re-encrypted for the receiver)")
	transferAgentCmd.Flags().String("sealed-key-file", "", "sealed AES key for the receiver")
	transferAgentCmd.Flags().Uint("current-version", 0, "override current on-chain version (0 = auto-fetch)")

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

	historyCmd.Flags().Uint64("agent-id", 0, "INFT agent token ID")
	historyCmd.Flags().Int("limit", 20, "Max strikes to fetch")

	rootCmd.AddCommand(
		gatesCmd, strikeCmd, storeCmd, discoveryCmd,
		mintAgentCmd, updateAgentCmd, statusCmd, agentInfoCmd,
		recordOutcomeCmd, searchCmd, setINFTCmd, scanCmd, historyCmd,
		// ERC-7857 + 0G Storage integration
		sealIntelligenceCmd, verifyCmd, orchestrateCmd, transferAgentCmd, setOracleCmd,
	)
}

func main() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}
