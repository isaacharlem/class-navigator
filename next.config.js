/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "standalone",

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
