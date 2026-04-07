.PHONY: core test-core contracts test-contracts deploy deploy-inft deploy-link skill gates discover mint-agent store-evidence status agent-info record-outcome clean all test

OG_TESTNET_RPC ?= https://evmrpc-testnet.0g.ai

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
	@echo "=== Deploying to 0G Galileo Testnet ==="
	@echo "Note: forge script doesn't support chain 16602, using forge create + cast send"
	@echo ""
	@echo "Step 1: Deploy ConvictionLog"
	cd contracts && forge create src/ConvictionLog.sol:ConvictionLog \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_TESTNET_RPC)} \
		--private-key $${OG_CHAIN_PRIVATE_KEY} \
		--legacy --broadcast
	@echo ""
	@echo "Step 2: Deploy MusashiINFT (paste ConvictionLog address below)"
	@echo "  make deploy-inft CONVICTION_LOG=0x..."
	@echo ""
	@echo "Step 3: Link contracts"
	@echo "  make deploy-link CONVICTION_LOG=0x... INFT=0x..."

deploy-inft:
	@test -n "$(CONVICTION_LOG)" || (echo "Usage: make deploy-inft CONVICTION_LOG=0x..." && exit 1)
	cd contracts && forge create src/MusashiINFT.sol:MusashiINFT \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_TESTNET_RPC)} \
		--private-key $${OG_CHAIN_PRIVATE_KEY} \
		--legacy --broadcast --gas-limit 3000000 \
		--constructor-args $(CONVICTION_LOG)

deploy-link:
	@test -n "$(CONVICTION_LOG)" || (echo "Usage: make deploy-link CONVICTION_LOG=0x... INFT=0x..." && exit 1)
	@test -n "$(INFT)" || (echo "Usage: make deploy-link CONVICTION_LOG=0x... INFT=0x..." && exit 1)
	cast send $(CONVICTION_LOG) "setINFT(address)" $(INFT) \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_TESTNET_RPC)} \
		--private-key $${OG_CHAIN_PRIVATE_KEY} \
		--legacy

skill:
	@test -f SKILL.md && echo "SKILL.md exists" || (echo "SKILL.md missing!" && exit 1)
	@head -1 SKILL.md | grep -q "^---" && echo "SKILL.md has frontmatter" || (echo "SKILL.md missing frontmatter!" && exit 1)

gates:
	@test -n "$(TOKEN)" || (echo "Usage: make gates TOKEN=0x... CHAIN=1" && exit 1)
	./scripts/gate_check.sh "$(TOKEN)" "$(or $(CHAIN),1)"

discover:
	scripts/musashi-core/musashi-core discover --chain "$(or $(CHAIN),1)" --limit "$(or $(LIMIT),20)"

mint-agent:
	scripts/musashi-core/musashi-core mint-agent \
		--name "MUSASHI" \
		--config-hash "$(CONFIG_HASH)" \
		--intelligence-hash "$(INTEL_HASH)"

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
