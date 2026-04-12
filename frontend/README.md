# MUSASHI Frontend

Next.js dashboard for the MUSASHI reputation protocol on 0G Mainnet.

**Live:** [https://musashi-agent.xyz](https://musashi-agent.xyz)

## Setup

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Configuration

Contract addresses and chain config are in `src/lib/contracts.ts` and `src/lib/wagmi.ts`. Both point to 0G Mainnet (Chain ID: 16661).

| Contract | Address |
|----------|---------|
| ConvictionLog | `0x2B84aC25498FF0157fAB04fEa9e3544A14882A15` |
| MusashiINFT (ERC-7857) | `0x74BC82d4A348d661ffF344A4C21c4C04F47C1d4c` |

Override via env vars if you redeploy: `NEXT_PUBLIC_CONVICTION_LOG_ADDRESS`, `NEXT_PUBLIC_MUSASHI_INFT_ADDRESS`.

## Components

- **TokenScanner** -- Search and scan tokens across 6 chains
- **GatePipeline** -- Visual gate results display
- **StrikeLedger** -- Browse published STRIKEs from ConvictionLog
- **StrikePublisher** -- Publish STRIKEs from the browser
- **ReputationPanel** -- Per-agent and global reputation stats
- **AgentChat** -- Interactive agent analysis interface
- **CommandBar** -- Quick command interface
- **WalletConnect** -- MetaMask / injected wallet connection
