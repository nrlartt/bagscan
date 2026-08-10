import type { NextConfig } from "next";

/**
 * Baseline hardening for the public deployment. No CSP here on purpose: wagmi
 * wallet connectors and injected providers need inline styles/scripts, so a
 * policy has to be introduced deliberately and tested end-to-end.
 */
const SECURITY_HEADERS = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
];

const nextConfig: NextConfig = {
  // Don't advertise the framework version to scanners.
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: SECURITY_HEADERS }];
  },
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
    /**
     * Token art is user-supplied and can live on any gateway, so the host stays
     * open — but only over TLS (plain http would be blocked as mixed content
     * anyway) and never as SVG, which can carry script.
     */
    dangerouslyAllowSVG: false,
    contentDispositionType: "attachment",
    remotePatterns: [{ protocol: "https", hostname: "**", pathname: "**" }],
  },
};

export default nextConfig;
