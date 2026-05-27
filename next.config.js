/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['socket.io-client'] },
  env: {
    // All backend routes are served from a single unified API service.
    // In production, set this to your Render service URL.
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
  },
};
module.exports = nextConfig;
