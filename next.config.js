/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: { serverComponentsExternalPackages: ['socket.io-client'] },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_PATIENT_API_URL: process.env.NEXT_PUBLIC_PATIENT_API_URL || 'http://localhost:3002',
    NEXT_PUBLIC_APPOINTMENT_API_URL: process.env.NEXT_PUBLIC_APPOINTMENT_API_URL || 'http://localhost:3003',
    NEXT_PUBLIC_BILLING_API_URL: process.env.NEXT_PUBLIC_BILLING_API_URL || 'http://localhost:3006',
  },
};
module.exports = nextConfig;
