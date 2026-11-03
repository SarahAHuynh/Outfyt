import type { NextConfig } from "next";
const nextConfig: NextConfig = { reactStrictMode: true, turbopack: { resolveAlias: { "iceberg-js": "./node_modules/iceberg-js" } } };
export default nextConfig;
