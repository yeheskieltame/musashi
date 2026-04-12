import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Providers } from "@/lib/providers";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import ChatBubble from "@/components/ChatBubble";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500"],
});

const SITE_URL = "https://musashi-agent.xyz";
const SITE_NAME = "MUSASHI 武蔵";
const TITLE =
  "MUSASHI 武蔵 — On-Chain Reputation Protocol for AI Agents | Built on 0G";
const DESCRIPTION =
  "MUSASHI 武蔵 is the first on-chain reputation protocol for AI agents on 0G. Conviction-weighted token intelligence through 7 elimination gates, 4 specialist analyses, adversarial bull/bear debate, and verifiable evidence on 0G Storage. Runs as an OpenClaw Skill, Claude Code slash commands, and a Next.js dashboard. ERC-7857 INFT identity, ConvictionLog STRIKEs, and merkle-proof audit trails on 0G Chain.";
const SHORT_DESCRIPTION =
  "Conviction-weighted token intelligence + on-chain reputation protocol for AI agents. 7 elimination gates, adversarial debate, ERC-7857 INFT, evidence on 0G Storage.";

const KEYWORDS = [
  "MUSASHI",
  "武蔵",
  "MUSASHI agent",
  "musashi-agent.xyz",
  "0G",
  "0G Labs",
  "0G Chain",
  "0G Storage",
  "0G Mainnet",
  "Build on 0G",
  "0G Hackathon",
  "0GHackathon",
  "BuildOn0G",
  "INFT",
  "ERC-7857",
  "Intelligent NFT",
  "AI agent identity",
  "agent reputation protocol",
  "on-chain reputation",
  "verifiable AI agent track record",
  "ConvictionLog",
  "MusashiINFT",
  "conviction-weighted intelligence",
  "token intelligence",
  "narrative intelligence",
  "narrative meta",
  "crypto narrative analysis",
  "token analysis",
  "token scanner",
  "memecoin scanner",
  "DeFi token research",
  "honeypot detection",
  "rug check",
  "smart contract safety",
  "GoPlus security",
  "DexScreener",
  "GeckoTerminal",
  "DefiLlama",
  "CoinGecko",
  "elimination gates",
  "7 gates",
  "adversarial debate",
  "bull bear researcher",
  "conviction judge",
  "specialist analysis",
  "agent memory",
  "on-chain learning",
  "OpenClaw",
  "OpenClaw Skill",
  "Claude Code",
  "Claude Code slash commands",
  "AI agent infrastructure",
  "agentic infrastructure",
  "Web3 AI agent",
  "crypto AI agent",
  "trading agent",
  "TradingAgents",
  "Tessera",
  "merkle proof evidence",
  "verifiable evidence",
  "Ethereum",
  "BSC",
  "Polygon",
  "Arbitrum",
  "Base",
  "0G EVM",
  "Yeheskiel Yunus Tame",
  "YeheskielTame",
];

export const viewport: Viewport = {
  themeColor: "#0a0e1a",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: TITLE,
    template: "%s | MUSASHI 武蔵 — On-Chain Agent Reputation on 0G",
  },
  description: DESCRIPTION,
  applicationName: SITE_NAME,
  generator: "Next.js",
  referrer: "origin-when-cross-origin",
  keywords: KEYWORDS,
  authors: [
    { name: "Yeheskiel Yunus Tame", url: "https://x.com/YeheskielTame" },
  ],
  creator: "Yeheskiel Yunus Tame",
  publisher: "MUSASHI",
  category: "technology",
  classification: "AI Agent Infrastructure, DeFi, Web3, Crypto Analytics",
  formatDetection: { email: false, address: false, telephone: false },
  alternates: {
    canonical: SITE_URL,
    languages: {
      "en-US": SITE_URL,
      "x-default": SITE_URL,
    },
  },
  icons: {
    icon: [
      { url: "/musashi-favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/musashi-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/musashi-icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/musashi-icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: TITLE,
    description: SHORT_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/musashi-logo.png",
        width: 1200,
        height: 630,
        alt: "MUSASHI 武蔵 — Conviction-Weighted Token Intelligence on 0G",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@YeheskielTame",
    creator: "@YeheskielTame",
    title: TITLE,
    description: SHORT_DESCRIPTION,
    images: ["/musashi-logo.png"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  verification: {
    google: "3S_QH_QsQ1We6j6VCgukuQpVLmvZZ08z3kIulV7gz7o",
  },
  other: {
    "theme-color": "#0a0e1a",
  },
};

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#org`,
      name: "MUSASHI",
      alternateName: ["MUSASHI 武蔵", "Musashi Agent"],
      url: SITE_URL,
      logo: `${SITE_URL}/musashi-logo.png`,
      sameAs: [
        "https://github.com/yeheskieltame/musashi",
        "https://x.com/YeheskielTame",
      ],
      founder: {
        "@type": "Person",
        name: "Yeheskiel Yunus Tame",
        url: "https://x.com/YeheskielTame",
      },
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SHORT_DESCRIPTION,
      inLanguage: "en-US",
      publisher: { "@id": `${SITE_URL}/#org` },
      potentialAction: {
        "@type": "SearchAction",
        target: `${SITE_URL}/dashboard?token={search_term_string}`,
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "MUSASHI 武蔵",
      alternateName: "MUSASHI Agent",
      applicationCategory: ["FinanceApplication", "DeveloperApplication"],
      operatingSystem: "Web, macOS, Linux, Windows",
      url: SITE_URL,
      downloadUrl: "https://github.com/yeheskieltame/musashi",
      description: DESCRIPTION,
      author: { "@id": `${SITE_URL}/#org` },
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      keywords: KEYWORDS.join(", "),
      featureList: [
        "7 elimination gates for token analysis",
        "Cross-domain pattern detection (武蔵 Musashi Pattern)",
        "Adversarial bull/bear debate with live web evidence",
        "ERC-7857 INFT agent identity (MusashiINFT)",
        "On-chain reputation via ConvictionLog on 0G Chain",
        "Verifiable evidence archive on 0G Storage with merkle proofs",
        "OpenClaw Skill + Claude Code slash commands",
        "Multi-chain support: Ethereum, BSC, Polygon, Arbitrum, Base, 0G",
      ],
    },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${inter.variable} ${jetbrainsMono.variable}`}>
      <head>
        <link rel="manifest" href="/site.webmanifest" />
        <link rel="preconnect" href="https://chainscan.0g.ai" />
        <link rel="dns-prefetch" href="https://evmrpc.0g.ai" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <Providers>
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
          <ErrorBoundary>
            <ChatBubble />
          </ErrorBoundary>
        </Providers>
      </body>
    </html>
  );
}
