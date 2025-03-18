/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

  // Use custom webpack configuration to handle PDF.js worker
  webpack: (config, { isServer }) => {
    // Add special handling for PDF.js worker
    // This ensures that both pdf.js and the worker are bundled correctly
    config.module.rules.push({
      test: /pdf\.worker\.(min\.)?js/,
      type: "asset/resource",
      generator: {
        filename: "static/chunks/[name].[hash][ext]",
      },
    });

    return config;
  },

  // Configure the build ID to be deterministic for better caching
  generateBuildId: async () => {
    return process.env.BUILD_ID || "development";
  },

  // Fixed experimental configuration
  experimental: {
    serverActions: {
      // Using default configuration
    },
    turbo: {
      // The default configuration is fine for now
    },
  },
};

module.exports = nextConfig;
