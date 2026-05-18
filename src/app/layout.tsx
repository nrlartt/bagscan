import type { Metadata, Viewport } from "next";
import { Share_Tech_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { DiscoverySearchProvider } from "@/components/bagscan/DiscoverySearchContext";
import { BagScanShell } from "@/components/bagscan/BagScanShell";
import "./globals.css";

const shareTechMono = Share_Tech_Mono({
  subsets: ["latin"],
  weight: "400",
  display: "swap",
});

export const metadata: Metadata = {
  title: "BagScan - Bags-Native Token Discovery Terminal",
  description:
    "Browse Bags-launched tokens, inspect creator details, track official market cap or clearly labeled FDV fallback alongside fee metrics, quick-buy tokens, and launch through BagScan with native partner revenue sharing.",
  icons: { icon: "/favicon.svg" },
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
          <DiscoverySearchProvider>
            <div className="crt-scanlines" />
            <div className="crt-flicker" />

            <BagScanShell>{children}</BagScanShell>
          </DiscoverySearchProvider>
        </Providers>
      </body>
    </html>
  );
}
