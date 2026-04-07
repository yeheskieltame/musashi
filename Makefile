.PHONY: core contracts skill clean test status agent-info record-outcome

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
	cd contracts && forge script script/Deploy.s.sol \
		--rpc-url $${OG_CHAIN_RPC:-$(OG_TESTNET_RPC)} \
		--broadcast

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
