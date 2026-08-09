import type { Metadata, Viewport } from "next";
import { Share_Tech_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { DiscoverySearchProvider } from "@/components/bagscan/DiscoverySearchContext";
import { NetworkProvider } from "@/components/bagscan/NetworkContext";
import { BagScanShell } from "@/components/bagscan/BagScanShell";
import { SITE_DESCRIPTION, SITE_NAME, SITE_TITLE, SITE_URL } from "@/lib/site";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · BagScan",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "Bags",
    "bags.fm",
    "Solana",
    "Robinhood Chain",
    "token discovery",
    "bonding curve",
    "memecoin launch",
    "BagScan",
  ],
  alternates: { canonical: "/" },
  icons: { icon: "/favicon.svg" },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b0e11",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${shareTechMono.className} min-h-screen antialiased`}>
        <Providers>
          <NetworkProvider>
            <DiscoverySearchProvider>
              <div className="crt-scanlines" />
              <div className="crt-flicker" />

              <BagScanShell>{children}</BagScanShell>
            </DiscoverySearchProvider>
          </NetworkProvider>
        </Providers>
      </body>
    </html>
  );
}
