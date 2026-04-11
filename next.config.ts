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
};

export default nextConfig;
