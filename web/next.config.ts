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
};

export default nextConfig;
