import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
