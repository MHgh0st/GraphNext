import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  
  /* config options here */
  reactCompiler: true,
  webpack: (config, { dev }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000, // Check for changes every second
        aggregateTimeout: 300, // Delay before rebuilding
      };
    }
    return config;
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  
};

export default nextConfig;
