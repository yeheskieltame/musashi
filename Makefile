.PHONY: core test-core contracts test-contracts deploy deploy-inft deploy-link skill gates discover mint-agent store-evidence status agent-info record-outcome clean all test

OG_DEFAULT_RPC ?= https://evmrpc.0g.ai

core:
	cd scripts/musashi-core && go build -o musashi-core ./cmd/musashi/
	@echo "Built: scripts/musashi-core/musashi-core"

test-core:
	cd scripts/musashi-core && go test ./...

contracts:
	cd contracts && forge build

test-contracts:
	cd contracts && forge test -vvv

deploy:
	@echo "=== Deploying to 0G Mainnet ==="
	@echo "Note: forge script doesn't support chain 16661, using forge create + cast send"
	@echo ""
	@echo "--- Setup keystore (one-time): ---"
	@echo "  cast wallet import musashi-deployer --interactive"
	@echo ""
	@echo "--- Or use env var (less secure, visible in ps): ---"
	@echo "  export OG_CHAIN_PRIVATE_KEY=0x..."
	@echo ""
	@echo "Step 1: Deploy ConvictionLog"
	@echo "  make deploy-conviction ACCOUNT=musashi-deployer"
	@echo "  (or: make deploy-conviction USE_KEY=1)"
	@echo ""
	@echo "Step 2: Deploy MusashiINFT"
	@echo "  make deploy-inft CONVICTION_LOG=0x... ACCOUNT=musashi-deployer"
	@echo ""
	@echo "Step 3: Link contracts"
	@echo "  make deploy-link CONVICTION_LOG=0x... INFT=0x... ACCOUNT=musashi-deployer"

# Resolve signer: prefer --account (keystore), fall back to --private-key (env var)
ifdef ACCOUNT
SIGNER_FLAG = --account $(ACCOUNT)
else ifdef USE_KEY
SIGNER_FLAG = --private-key $${OG_CHAIN_PRIVATE_KEY}
else
SIGNER_FLAG = --account musashi-deployer
endif

deploy-conviction:
	cd contracts && forge create src/ConvictionLog.sol:ConvictionLog \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_DEFAULT_RPC)} \
		$(SIGNER_FLAG) --legacy --broadcast

deploy-inft:
	@test -n "$(CONVICTION_LOG)" || (echo "Usage: make deploy-inft CONVICTION_LOG=0x... [ACCOUNT=name]" && exit 1)
	cd contracts && forge create src/MusashiINFT.sol:MusashiINFT \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_DEFAULT_RPC)} \
		$(SIGNER_FLAG) --legacy --broadcast --gas-limit 3000000 \
		--constructor-args $(CONVICTION_LOG)

deploy-link:
	@test -n "$(CONVICTION_LOG)" || (echo "Usage: make deploy-link CONVICTION_LOG=0x... INFT=0x... [ACCOUNT=name]" && exit 1)
	@test -n "$(INFT)" || (echo "Usage: make deploy-link CONVICTION_LOG=0x... INFT=0x... [ACCOUNT=name]" && exit 1)
	cast send $(CONVICTION_LOG) "setINFT(address)" $(INFT) \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_DEFAULT_RPC)} \
		$(SIGNER_FLAG) --legacy

skill:
	@test -f SKILL.md && echo "SKILL.md exists" || (echo "SKILL.md missing!" && exit 1)
	@head -1 SKILL.md | grep -q "^---" && echo "SKILL.md has frontmatter" || (echo "SKILL.md missing frontmatter!" && exit 1)

gates:
	@test -n "$(TOKEN)" || (echo "Usage: make gates TOKEN=0x... CHAIN=1" && exit 1)
	./scripts/gate_check.sh "$(TOKEN)" "$(or $(CHAIN),1)"

scan:
	scripts/musashi-core/musashi-core scan --chain "$(or $(CHAIN),0)" --limit "$(or $(LIMIT),10)" $(if $(GATES),--gates,)

discover:
	scripts/musashi-core/musashi-core discover --chain "$(or $(CHAIN),1)" --limit "$(or $(LIMIT),20)"

seal-intelligence:
	@test -n "$(INPUT)" || (echo "Usage: make seal-intelligence INPUT=/path/to/intelligence.tar.gz" && exit 1)
	scripts/musashi-core/musashi-core seal-intelligence --input "$(INPUT)"

# Mint a MUSASHI agent as an ERC-7857 INFT. Run `make seal-intelligence` first
# to produce STORAGE_ROOT (0G Storage merkle root) and SEALED_KEY_FILE (ECIES
# wrapped AES key), then:
#   make mint-agent STORAGE_ROOT=0x… SEALED_KEY_FILE=/tmp/foo.sealed.hex
mint-agent:
	@test -n "$(STORAGE_ROOT)" || (echo "Usage: make mint-agent STORAGE_ROOT=0x… SEALED_KEY_FILE=path [METADATA_HASH=0x…]" && exit 1)
	@test -n "$(SEALED_KEY_FILE)" || (echo "Usage: make mint-agent STORAGE_ROOT=0x… SEALED_KEY_FILE=path [METADATA_HASH=0x…]" && exit 1)
	scripts/musashi-core/musashi-core mint-agent \
		--name "$(or $(NAME),MUSASHI)" \
		--storage-root "$(STORAGE_ROOT)" \
		--metadata-hash "$(or $(METADATA_HASH),0x0000000000000000000000000000000000000000000000000000000000000000)" \
		--sealed-key-file "$(SEALED_KEY_FILE)"

update-agent:
	@test -n "$(TOKEN_ID)" || (echo "Usage: make update-agent TOKEN_ID=0 STORAGE_ROOT=0x… SEALED_KEY_FILE=path" && exit 1)
	@test -n "$(STORAGE_ROOT)" || (echo "Usage: make update-agent TOKEN_ID=0 STORAGE_ROOT=0x… SEALED_KEY_FILE=path" && exit 1)
	@test -n "$(SEALED_KEY_FILE)" || (echo "Usage: make update-agent TOKEN_ID=0 STORAGE_ROOT=0x… SEALED_KEY_FILE=path" && exit 1)
	scripts/musashi-core/musashi-core update-agent \
		--token-id "$(TOKEN_ID)" \
		--storage-root "$(STORAGE_ROOT)" \
		--sealed-key-file "$(SEALED_KEY_FILE)"

verify-strike:
	@test -n "$(STRIKE_ID)" || (echo "Usage: make verify-strike STRIKE_ID=0" && exit 1)
	scripts/musashi-core/musashi-core verify --strike-id "$(STRIKE_ID)"

store-evidence:
	@test -n "$(EVIDENCE)" || (echo "Usage: make store-evidence EVIDENCE='{...}'" && exit 1)
	scripts/musashi-core/musashi-core store "$(EVIDENCE)"

status:
	scripts/musashi-core/musashi-core status

agent-info:
	scripts/musashi-core/musashi-core agent-info --token-id "$(or $(TOKEN_ID),0)"

record-outcome:
	@test -n "$(STRIKE_ID)" || (echo "Usage: make record-outcome STRIKE_ID=0 RETURN_BPS=500" && exit 1)
	scripts/musashi-core/musashi-core record-outcome --strike-id "$(STRIKE_ID)" --return-bps "$(or $(RETURN_BPS),0)"

clean:
	rm -f scripts/musashi-core/musashi-core
	rm -rf contracts/out contracts/cache

all: core contracts skill
	@echo "All components built"

test: test-core test-contracts
	@echo "All tests passed"
