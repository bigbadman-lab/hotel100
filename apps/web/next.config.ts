import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@hotel100/domain", "@hotel100/config"],
  serverExternalPackages: ["pg"],
};

export default nextConfig;
