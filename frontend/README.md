# MUSASHI Frontend

Next.js dashboard for the MUSASHI reputation protocol on 0G Mainnet.

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
| ConvictionLog | `0xdB5EB0d68e73902eC630256902825a72E4B4d1Ed` |
| MusashiINFT | `0xfFE8dAa358cFb3EF8A2e20B0C6fBBF181942dc32` |

## Components

- **TokenScanner** -- Search and scan tokens across 6 chains
- **GatePipeline** -- Visual gate results display
- **StrikeLedger** -- Browse published STRIKEs from ConvictionLog
- **StrikePublisher** -- Publish STRIKEs from the browser
- **ReputationPanel** -- Per-agent and global reputation stats
- **AgentChat** -- Interactive agent analysis interface
- **CommandBar** -- Quick command interface
- **WalletConnect** -- MetaMask / injected wallet connection
