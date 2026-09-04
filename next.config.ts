import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  reactStrictMode: true,
  serverExternalPackages: ["postgres"],
  poweredByHeader: false
};

export default nextConfig;
