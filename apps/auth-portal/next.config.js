/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@ops/ui", "@ops/auth"],
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
  output: process.env.NEXT_OUTPUT_STANDALONE === "true" ? "standalone" : undefined,
  env: {
    NEXT_PUBLIC_OPS_API_URL: process.env.NEXT_PUBLIC_OPS_API_URL || "http://localhost:8080",
    MANAGER_DASHBOARD_URL: process.env.MANAGER_DASHBOARD_URL || "http://localhost:3019",
    PAYROLL_DASHBOARD_URL: process.env.PAYROLL_DASHBOARD_URL || "http://localhost:3012",
    OWNER_DASHBOARD_URL: process.env.OWNER_DASHBOARD_URL || "http://localhost:3026",
    CS_DASHBOARD_URL: process.env.CS_DASHBOARD_URL || "http://localhost:3014",
  },
};
module.exports = nextConfig;
