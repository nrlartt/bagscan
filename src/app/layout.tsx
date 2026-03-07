import type { Metadata } from "next";
import { Providers } from "@/components/Providers";
import { TopNav } from "@/components/bagscan/TopNav";
import { Footer } from "@/components/bagscan/Footer";
import "./globals.css";

export const metadata: Metadata = {
  title: "BagScan — Bags-Native Token Discovery Terminal",
  description:
    "Browse Bags-launched tokens, inspect creator details, view FDV and fee metrics, quick-buy tokens, and launch through BagScan with native partner revenue sharing.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col antialiased">
        <Providers>
          {/* CRT scan lines overlay */}
          <div className="crt-scanlines" />
          <div className="crt-flicker" />

          <TopNav />
          <main className="flex-1 relative z-10">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
