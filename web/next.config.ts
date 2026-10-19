import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: process.env.STANDALONE === "1" ? "standalone" : undefined,
  outputFileTracingRoot: path.join(__dirname, ".."),
  transpilePackages: ["@anima/shared"],
  async rewrites() {
    if (!process.env.API_PROXY_URL) return [];
    return [{ source: "/api/:path*", destination: `${process.env.API_PROXY_URL}/:path*` }];
  },
};

export default nextConfig;
