import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Set Turbopack root to web/ directory to avoid scanning parent Python venv
    root: path.resolve(__dirname),
  },
  // Exclude Python venv and other non-web assets from Next.js watch/build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        child_process: false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // HTTPS hardening (HSTS). Only respected over HTTPS responses.
          // NOTE: includeSubDomains can be removed if you ever need to serve plain HTTP on any subdomain.
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
