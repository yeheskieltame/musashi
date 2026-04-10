import type { Metadata } from "next";
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

export const metadata: Metadata = {
  title: "MUSASHI — Conviction-Weighted Token Intelligence",
  description:
    "AI-powered token analysis through 7 elimination gates, cross-domain pattern detection, and adversarial debate. Built on 0G.",
  icons: {
    icon: [
      { url: "/musashi-favicon-16.png", sizes: "16x16", type: "image/png" },
      { url: "/musashi-favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/musashi-icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MUSASHI — Conviction-Weighted Token Intelligence",
    description:
      "7 elimination gates. 4 specialist analyses. Adversarial debate. Every conviction on-chain.",
    images: ["/musashi-logo.png"],
  },
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
