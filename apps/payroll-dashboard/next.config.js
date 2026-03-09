/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ops/ui"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
module.exports = nextConfig;
