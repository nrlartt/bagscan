import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "web-push",
    "https-proxy-agent",
    "agent-base",
    "@prisma/client",
    "@prisma/adapter-pg",
    "pg",
  ],
  turbopack: {
    root: process.cwd(),
  },
  typescript: {
    // Prisma 7 on Windows can trigger schema-engine EPERM during Next's own
    // type-check pass. We run `tsc --noEmit` explicitly in the build script
    // instead, so type safety is still enforced without blocking production builds.
    ignoreBuildErrors: true,
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    /** CDN & IPFS token art — optimize + cache instead of shipping full-size originals to the client. */
    minimumCacheTTL: 60 * 60 * 24,
    remotePatterns: [
      { protocol: "https", hostname: "**", pathname: "**" },
      { protocol: "http", hostname: "**", pathname: "**" },
    ],
  },
};

export default nextConfig;
