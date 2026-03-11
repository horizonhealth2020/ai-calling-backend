/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ops/ui"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_OPS_API_URL: process.env.NEXT_PUBLIC_OPS_API_URL || "http://localhost:8080",
  },
};
module.exports = nextConfig;
