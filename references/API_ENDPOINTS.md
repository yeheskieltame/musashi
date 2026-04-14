# API Endpoints (all free)

| Service | Base URL | Rate | Key endpoints / fields |
|---|---|---|---|
| **GoPlus** | `https://api.gopluslabs.io/api/v1` | generous | `GET /token_security/{chain}?contract_addresses={addr}` → `is_honeypot, is_mintable, can_take_back_ownership, buy_tax, sell_tax, lp_holders[], holder_count, creator_address` |
| **DexScreener** | `https://api.dexscreener.com` | ~30/min | `/latest/dex/tokens/{addr}`, `/latest/dex/pairs/{chain}/{pair}`, `/latest/dex/search?q=`, `/token-boosts/latest/v1` → `priceUsd, volume.{m5,h1,h6,h24}, liquidity.usd, txns.h24.{buys,sells}, fdv, marketCap, pairCreatedAt` |
| **GeckoTerminal** | `https://api.geckoterminal.com/api/v2` | 10/min | `/networks/{net}/tokens/{addr}`, `/networks/{net}/new_pools`, `/networks/trending_pools`, `/networks/{net}/pools/{pool}/trades`, `/networks/{net}/pools/{pool}/ohlcv/{tf}` |
| **DefiLlama** | `https://api.llama.fi` | generous | `/v2/chains`, `/v2/historicalChainTvl/{chain}`, `/stablecoins`, `/stablecoins/chains` |
| **CoinGecko** | `https://api.coingecko.com/api/v3` | 10–30/min | `/global`, `/search/trending`, `/coins/categories` |
| **Neynar (Farcaster)** | `https://api.neynar.com/v2/farcaster` | free key | `/cast/search?q=` (optional — browse Warpcast directly works too) |

## Chain IDs
ETH=1 · BSC=56 · Polygon=137 · Arbitrum=42161 · Base=8453 · 0G=16661

## GeckoTerminal network slugs
eth · bsc · polygon_pos · arbitrum · base

## Public RPCs
ETH `https://eth.llamarpc.com` · BSC `https://bsc-dataseed.binance.org` · Polygon `https://polygon-rpc.com` · Arbitrum `https://arb1.arbitrum.io/rpc` · Base `https://mainnet.base.org` · 0G `https://evmrpc.0g.ai`

## Block explorers (API + UI)
`etherscan.io` · `bscscan.com` · `polygonscan.com` · `arbiscan.io` · `basescan.org` · `chainscan.0g.ai`
All Etherscan-family expose `/api?module=contract&action=getsourcecode&address=<addr>` and `/api?module=token&action=tokenholderlist&contractaddress=<addr>` without a key (rate-limited).

## 0G Infrastructure
Chain RPC `https://evmrpc.0g.ai` (chainId 16661) · Storage indexer `https://indexer-storage-turbo.0g.ai` · Explorer `https://chainscan.0g.ai` · Storage scan `https://storagescan.0g.ai`

## Smart-money profile tools (for on-chain specialist)
`https://debank.com/profile/{addr}` · `https://zapper.xyz/account/{addr}`
