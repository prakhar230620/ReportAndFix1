/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(process.env.NEXT_DIST_DIR ? { distDir: process.env.NEXT_DIST_DIR } : {}),
  experimental: {
    staleTimes: {
      dynamic: 0,
      static: 180,
    },
  },
};

export default nextConfig;



