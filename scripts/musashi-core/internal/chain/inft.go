package chain

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"math/big"
	"os"
	"reflect"
	"strings"
	"time"

	ethereum "github.com/ethereum/go-ethereum"
	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
)

// MusashiINFT ABI — only the functions the Go binary actually calls.
// Using the ABI package eliminates hand-rolled encoding bugs (old inft.go
// had to manually compute string offsets, pad dynamic fields, etc.).
const musashiINFTABI = `[
  {"type":"function","name":"mint","stateMutability":"nonpayable","inputs":[
    {"name":"_name","type":"string"},
    {"name":"_storageRoot","type":"bytes32"},
    {"name":"_metadataHash","type":"bytes32"},
    {"name":"_sealedKey","type":"bytes"}
  ],"outputs":[{"name":"id","type":"uint256"}]},

  {"type":"function","name":"updateIntelligence","stateMutability":"nonpayable","inputs":[
    {"name":"tokenId","type":"uint256"},
    {"name":"newStorageRoot","type":"bytes32"},
    {"name":"newSealedKey","type":"bytes"}
  ],"outputs":[]},

  {"type":"function","name":"transfer","stateMutability":"nonpayable","inputs":[
    {"name":"tokenId","type":"uint256"},
    {"name":"to","type":"address"},
    {"name":"newStorageRoot","type":"bytes32"},
    {"name":"newSealedKey","type":"bytes"},
    {"name":"oracleProof","type":"bytes"}
  ],"outputs":[]},

  {"type":"function","name":"setOracle","stateMutability":"nonpayable","inputs":[
    {"name":"_oracle","type":"address"}
  ],"outputs":[]},

  {"type":"function","name":"transferDigest","stateMutability":"view","inputs":[
    {"name":"tokenId","type":"uint256"},
    {"name":"version","type":"uint16"},
    {"name":"oldRoot","type":"bytes32"},
    {"name":"newRoot","type":"bytes32"},
    {"name":"to","type":"address"}
  ],"outputs":[{"name":"","type":"bytes32"}]},

  {"type":"function","name":"agentCount","stateMutability":"view","inputs":[],
   "outputs":[{"name":"","type":"uint256"}]},

  {"type":"function","name":"getAgent","stateMutability":"view","inputs":[
    {"name":"tokenId","type":"uint256"}
  ],"outputs":[{"name":"","type":"tuple","components":[
    {"name":"owner","type":"address"},
    {"name":"active","type":"bool"},
    {"name":"winRate","type":"uint16"},
    {"name":"convergenceAvg","type":"uint8"},
    {"name":"version","type":"uint16"},
    {"name":"storageRoot","type":"bytes32"},
    {"name":"metadataHash","type":"bytes32"},
    {"name":"totalStrikes","type":"uint64"},
    {"name":"createdAt","type":"uint48"},
    {"name":"updatedAt","type":"uint48"},
    {"name":"name","type":"string"}
  ]}]},

  {"type":"function","name":"getSealedKey","stateMutability":"view","inputs":[
    {"name":"tokenId","type":"uint256"}
  ],"outputs":[{"name":"","type":"bytes"}]},

  {"type":"function","name":"oracle","stateMutability":"view","inputs":[],
   "outputs":[{"name":"","type":"address"}]}
]`

var musashiINFT = mustParseABI(musashiINFTABI)

func mustParseABI(s string) abi.ABI {
	parsed, err := abi.JSON(strings.NewReader(s))
	if err != nil {
		panic(fmt.Sprintf("failed to parse MusashiINFT ABI: %v", err))
	}
	return parsed
}

// INFTResult is returned after an INFT operation.
type INFTResult struct {
	TxHash      string `json:"tx_hash"`
	BlockNumber uint64 `json:"block_number"`
	Contract    string `json:"contract_address"`
	ExplorerURL string `json:"explorer_url"`
	Action      string `json:"action"`
	TokenID     uint64 `json:"token_id,omitempty"`
}

// sendINFTTx is the common transaction plumbing used by all write calls.
func sendINFTTx(ctx context.Context, action string, calldata []byte) (*INFTResult, error) {
	rpcURL := os.Getenv("OG_CHAIN_RPC")
	if rpcURL == "" {
		rpcURL = DefaultOGChainRPC
	}
	privateKeyHex := os.Getenv("OG_CHAIN_PRIVATE_KEY")
	if privateKeyHex == "" {
		return nil, fmt.Errorf("OG_CHAIN_PRIVATE_KEY not set")
	}
	contractAddr := os.Getenv("MUSASHI_INFT_ADDRESS")
	if contractAddr == "" {
		return nil, fmt.Errorf("MUSASHI_INFT_ADDRESS not set")
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to 0G Chain: %w", err)
	}
	defer client.Close()

	privateKey, err := crypto.HexToECDSA(stripHexPrefix(privateKeyHex))
	if err != nil {
		return nil, fmt.Errorf("invalid private key: %w", err)
	}
	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("error casting public key")
	}
	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)

	nonce, err := client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return nil, fmt.Errorf("failed to get nonce: %w", err)
	}
	gasPrice, err := client.SuggestGasPrice(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get gas price: %w", err)
	}
	chainID, err := client.ChainID(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get chain ID: %w", err)
	}

	contract := common.HexToAddress(contractAddr)
	gasLimit, err := client.EstimateGas(ctx, ethereum.CallMsg{
		From: fromAddress,
		To:   &contract,
		Data: calldata,
	})
	if err != nil {
		gasLimit = 500000 // fallback for dynamic-bytes calls
	} else {
		gasLimit = gasLimit * 120 / 100
	}

	tx := types.NewTransaction(nonce, contract, big.NewInt(0), gasLimit, gasPrice, calldata)
	signedTx, err := types.SignTx(tx, types.NewEIP155Signer(chainID), privateKey)
	if err != nil {
		return nil, fmt.Errorf("failed to sign transaction: %w", err)
	}
	if err := client.SendTransaction(ctx, signedTx); err != nil {
		return nil, fmt.Errorf("failed to send transaction: %w", err)
	}

	receipt, err := bind.WaitMined(ctx, client, signedTx)
	if err != nil {
		return nil, fmt.Errorf("transaction not mined: %w", err)
	}
	if receipt.Status == 0 {
		return nil, fmt.Errorf("transaction reverted (tx: %s)", signedTx.Hash().Hex())
	}

	return &INFTResult{
		TxHash:      signedTx.Hash().Hex(),
		BlockNumber: receipt.BlockNumber.Uint64(),
		Contract:    contractAddr,
		ExplorerURL: fmt.Sprintf("%s/tx/%s", OGExplorerBase(), signedTx.Hash().Hex()),
		Action:      action,
	}, nil
}

// hexToBytes32 converts a 0x-prefixed hex root to a [32]byte.
func hexToBytes32(h string) ([32]byte, error) {
	var out [32]byte
	b := common.FromHex(h)
	if len(b) != 32 {
		return out, fmt.Errorf("expected 32 bytes, got %d (input: %s)", len(b), h)
	}
	copy(out[:], b)
	return out, nil
}

// MintAgent mints a new MUSASHI INFT. Requires an encrypted intelligence bundle
// already uploaded to 0G Storage (pass its merkle root as `storageRoot`) and a
// sealed symmetric key wrapped to the deployer's pubkey (from `seal-intelligence`).
func MintAgent(name, storageRoot, metadataHash string, sealedKey []byte) (string, error) {
	if len(sealedKey) == 0 {
		return "", fmt.Errorf("sealedKey required (run `musashi-core seal-intelligence` first)")
	}

	root, err := hexToBytes32(storageRoot)
	if err != nil {
		return "", fmt.Errorf("storageRoot: %w", err)
	}
	meta, err := hexToBytes32(metadataHash)
	if err != nil {
		return "", fmt.Errorf("metadataHash: %w", err)
	}

	calldata, err := musashiINFT.Pack("mint", name, root, meta, sealedKey)
	if err != nil {
		return "", fmt.Errorf("pack mint: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := sendINFTTx(ctx, "mint_agent", calldata)
	if err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(result, "", "  ")
	return string(b), nil
}

// UpdateAgentIntelligence replaces the encrypted intelligence pointer with a
// freshly-rotated AES key + new storage root. Same-owner path (no oracle proof
// needed — the owner already controls the sealed key).
func UpdateAgentIntelligence(tokenID uint64, newStorageRoot string, newSealedKey []byte) (string, error) {
	if os.Getenv("OG_CHAIN_PRIVATE_KEY") == "" {
		return `{"status":"skipped","reason":"OG_CHAIN_PRIVATE_KEY not set — analysis-only mode"}`, nil
	}
	if len(newSealedKey) == 0 {
		return "", fmt.Errorf("newSealedKey required")
	}
	root, err := hexToBytes32(newStorageRoot)
	if err != nil {
		return "", fmt.Errorf("newStorageRoot: %w", err)
	}

	calldata, err := musashiINFT.Pack("updateIntelligence", big.NewInt(int64(tokenID)), root, newSealedKey)
	if err != nil {
		return "", fmt.Errorf("pack updateIntelligence: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := sendINFTTx(ctx, "update_intelligence", calldata)
	if err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(result, "", "  ")
	return string(b), nil
}

// TransferAgent performs an ERC-7857 sealed transfer. The oracle must already
// have re-encrypted the intelligence blob for `to` and signed the digest.
func TransferAgent(tokenID uint64, to, newStorageRoot string, newSealedKey, oracleProof []byte) (string, error) {
	root, err := hexToBytes32(newStorageRoot)
	if err != nil {
		return "", fmt.Errorf("newStorageRoot: %w", err)
	}
	toAddr := common.HexToAddress(to)

	calldata, err := musashiINFT.Pack("transfer", big.NewInt(int64(tokenID)), toAddr, root, newSealedKey, oracleProof)
	if err != nil {
		return "", fmt.Errorf("pack transfer: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := sendINFTTx(ctx, "sealed_transfer", calldata)
	if err != nil {
		return "", err
	}
	result.TokenID = tokenID
	b, _ := json.MarshalIndent(result, "", "  ")
	return string(b), nil
}

// SetOracleAddress configures the re-encryption oracle on MusashiINFT.
// For hackathon scope the deployer's own address acts as oracle.
func SetOracleAddress(oracleAddr string) (string, error) {
	addr := common.HexToAddress(oracleAddr)
	calldata, err := musashiINFT.Pack("setOracle", addr)
	if err != nil {
		return "", fmt.Errorf("pack setOracle: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
	defer cancel()

	result, err := sendINFTTx(ctx, "set_oracle", calldata)
	if err != nil {
		return "", err
	}
	b, _ := json.MarshalIndent(result, "", "  ")
	return string(b), nil
}

// AgentInfo holds on-chain agent INFT data.
type AgentInfo struct {
	TokenID      uint64 `json:"token_id"`
	Owner        string `json:"owner"`
	Active       bool   `json:"active"`
	WinRate      uint16 `json:"win_rate_bps"`
	Version      uint16 `json:"version"`
	StorageRoot  string `json:"storage_root"`
	MetadataHash string `json:"metadata_hash"`
	TotalStrikes uint64 `json:"total_strikes"`
	Name         string `json:"name"`
	AgentCount   uint64 `json:"agent_count"`
	ContractAddr string `json:"contract_address"`
	ExplorerURL  string `json:"explorer_url"`
	StorageScan  string `json:"storage_scan_url,omitempty"`
}

// QueryAgent reads agent info from the MusashiINFT contract.
func QueryAgent(tokenID uint64) (string, error) {
	rpcURL := os.Getenv("OG_CHAIN_RPC")
	if rpcURL == "" {
		rpcURL = DefaultOGChainRPC
	}
	contractAddr := os.Getenv("MUSASHI_INFT_ADDRESS")
	if contractAddr == "" {
		return "", fmt.Errorf("MUSASHI_INFT_ADDRESS not set")
	}

	client, err := ethclient.Dial(rpcURL)
	if err != nil {
		return "", fmt.Errorf("failed to connect to 0G Chain: %w", err)
	}
	defer client.Close()

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	contract := common.HexToAddress(contractAddr)

	// agentCount()
	countData, err := musashiINFT.Pack("agentCount")
	if err != nil {
		return "", fmt.Errorf("pack agentCount: %w", err)
	}
	countRes, err := client.CallContract(ctx, ethereum.CallMsg{To: &contract, Data: countData}, nil)
	if err != nil {
		return "", fmt.Errorf("agentCount() call failed: %w", err)
	}
	countUnpacked, err := musashiINFT.Unpack("agentCount", countRes)
	if err != nil {
		return "", fmt.Errorf("unpack agentCount: %w", err)
	}
	agentCount := countUnpacked[0].(*big.Int).Uint64()

	info := AgentInfo{
		TokenID:      tokenID,
		AgentCount:   agentCount,
		ContractAddr: contractAddr,
		ExplorerURL:  fmt.Sprintf("%s/address/%s", OGExplorerBase(), contractAddr),
	}

	if agentCount == 0 || tokenID >= agentCount {
		b, _ := json.MarshalIndent(info, "", "  ")
		return string(b), nil
	}

	// getAgent(tokenId)
	getData, err := musashiINFT.Pack("getAgent", big.NewInt(int64(tokenID)))
	if err != nil {
		return "", fmt.Errorf("pack getAgent: %w", err)
	}
	agRes, err := client.CallContract(ctx, ethereum.CallMsg{To: &contract, Data: getData}, nil)
	if err != nil {
		return "", fmt.Errorf("getAgent() call failed: %w", err)
	}
	// getAgent returns a tuple. The abi package returns it as a Go struct via
	// `Unpack`, but the auto-generated struct has unstable field names, so we
	// reach into it via reflection rather than using UnpackIntoInterface (which
	// panics on our inline struct because uint48 → *big.Int vs struct tag
	// matching has edge cases).
	unpacked, err := musashiINFT.Unpack("getAgent", agRes)
	if err != nil {
		return "", fmt.Errorf("unpack getAgent: %w", err)
	}
	if len(unpacked) == 0 {
		return "", fmt.Errorf("getAgent returned no data")
	}

	tv := reflect.ValueOf(unpacked[0])
	if tv.Kind() != reflect.Struct {
		return "", fmt.Errorf("getAgent unpacked to %s, expected struct", tv.Kind())
	}

	readField := func(name string) reflect.Value {
		// ABI auto-capitalizes: owner → Owner, storageRoot → StorageRoot.
		capName := strings.ToUpper(name[:1]) + name[1:]
		return tv.FieldByName(capName)
	}

	if f := readField("owner"); f.IsValid() {
		info.Owner = f.Interface().(common.Address).Hex()
	}
	if f := readField("active"); f.IsValid() {
		info.Active = f.Bool()
	}
	if f := readField("winRate"); f.IsValid() {
		info.WinRate = uint16(f.Uint())
	}
	if f := readField("version"); f.IsValid() {
		info.Version = uint16(f.Uint())
	}
	if f := readField("storageRoot"); f.IsValid() {
		arr := f.Interface().([32]byte)
		info.StorageRoot = common.BytesToHash(arr[:]).Hex()
	}
	if f := readField("metadataHash"); f.IsValid() {
		arr := f.Interface().([32]byte)
		info.MetadataHash = common.BytesToHash(arr[:]).Hex()
	}
	if f := readField("totalStrikes"); f.IsValid() {
		info.TotalStrikes = f.Uint()
	}
	if f := readField("name"); f.IsValid() {
		info.Name = f.String()
	}

	if scan := os.Getenv("OG_STORAGE_SCAN_URL"); scan != "" || info.StorageRoot != "" {
		base := os.Getenv("OG_STORAGE_SCAN_URL")
		if base == "" {
			base = "https://storagescan.0g.ai"
		}
		info.StorageScan = base + "/tx/" + info.StorageRoot
	}

	b, _ := json.MarshalIndent(info, "", "  ")
	return string(b), nil
}
