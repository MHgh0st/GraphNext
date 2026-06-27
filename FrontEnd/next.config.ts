import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // webpack: (config, { dev }) => {
  //   if (dev) {
  //     config.watchOptions = {
  //       poll: 1000, // Check for changes every second
  //       aggregateTimeout: 300, // Delay before rebuilding
  //     };
  //   }
  //   return config;
  // },
  typescript: {
    ignoreBuildErrors: true,
  },
  turbopack: {
    rules: {
      '*.svg': {
        loaders: ['@svgr/webpack'],
        as: '*.js',
      },
    },
  },
  // async rewrites() {
  //   const backendUrl = process.env.INTERNAL_API_URL ?? "http://localhost:3001";
  //   return [
  //     {
  //       source: "/api/:path*",
  //       destination: `${backendUrl}/api/:path*`,
  //     },
  //     {
  //       source: "/health",
  //       destination: `${backendUrl}/health`,
  //     },
  //   ];
  // },
  
};

export default nextConfig;
