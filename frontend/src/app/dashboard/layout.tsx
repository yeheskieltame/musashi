import type { Metadata } from "next";

const SITE_URL = "https://musashi-agent.xyz";

export const metadata: Metadata = {
  title: "Dashboard — Token Scanner, Gate Pipeline & STRIKE Ledger",
  description:
    "Live MUSASHI 武蔵 dashboard on 0G Mainnet. Scan tokens across Ethereum, BSC, Polygon, Arbitrum, Base & 0G; run the 7-gate elimination pipeline; watch the bull/bear debate; publish ERC-7857 STRIKEs to ConvictionLog and download verifiable evidence from 0G Storage.",
  alternates: { canonical: `${SITE_URL}/dashboard` },
  openGraph: {
    type: "website",
    url: `${SITE_URL}/dashboard`,
    siteName: "MUSASHI 武蔵",
    title: "MUSASHI Dashboard — On-Chain Token Intelligence on 0G",
    description:
      "Token scanner, 7-gate pipeline, adversarial debate, ConvictionLog STRIKEs and 0G Storage evidence — live on 0G Mainnet.",
    images: [
      {
        url: "/musashi-logo.png",
        width: 1200,
        height: 630,
        alt: "MUSASHI Dashboard — Token Intelligence on 0G",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUSASHI Dashboard — Token Intelligence on 0G",
    description:
      "Scan, gate, debate, strike. The conviction-weighted dashboard on 0G Mainnet.",
    images: ["/musashi-logo.png"],
  },
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
