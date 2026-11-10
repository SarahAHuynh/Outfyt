import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode:true,
  poweredByHeader:false,
  images:{ remotePatterns:[{ protocol:"https",hostname:"images.unsplash.com" }] },
  turbopack:{ resolveAlias:{ "iceberg-js":"./node_modules/iceberg-js" } },
  async headers() {
    return [
      { source:"/:path*",headers:[{ key:"X-Content-Type-Options",value:"nosniff" },{ key:"X-Frame-Options",value:"DENY" },{ key:"Referrer-Policy",value:"strict-origin-when-cross-origin" }] },
      { source:"/api/:path*",headers:[{ key:"Cache-Control",value:"private, no-store" }] },
      { source:"/auth/:path*",headers:[{ key:"Cache-Control",value:"private, no-store" },{ key:"Referrer-Policy",value:"no-referrer" }] },
    ];
  },
};
export default nextConfig;
