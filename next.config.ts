import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */ eslint: {
    // ❌ This disables ESLint checks during `next build`
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
